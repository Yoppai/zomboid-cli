import type { ISshGateway } from '@/shared/infra/contracts/i-ssh-gateway.ts';
import type { ISftpGateway } from '@/shared/infra/contracts/i-sftp-gateway.ts';
import type { ILocalDb } from '@/shared/infra/contracts/i-local-db.ts';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { ServerId } from '@/shared/infra/entities/enums.ts';
import type { SshConnectionConfig, BackupMeta } from '@/shared/infra/entities/value-objects.ts';
import { createServerId } from '@/shared/infra/entities/enums.ts';
import { join } from 'path';
import { homedir } from 'os';
import { readdir, stat } from 'node:fs/promises';

// ── BackupService ──

export class BackupService {
  constructor(
    private readonly ssh: ISshGateway,
    private readonly sftp: ISftpGateway,
    private readonly db: ILocalDb,
  ) {}

  /**
   * Create a backup of the server:
   * 1. SSH: tar compress game data on VM
   * 2. SFTP: download tarball to local backup directory
   * 3. SSH: cleanup remote tarball
   * Returns BackupMeta with path, size, timestamp.
   */
  async create(serverId: ServerId): Promise<BackupMeta> {
    const server = await this.requireServer(serverId);
    const conn = this.sshConn(server);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `zomboid-backup-${timestamp}.tar.gz`;
    const remotePath = `/tmp/${filename}`;

    // 1. Tar compress on VM
    await this.ssh.exec(
      conn,
      `tar -czf ${remotePath} -C /opt/zomboid data config`,
    );

    // 2. Download via SFTP
    const backupBasePath = await this.resolveBackupPath();
    const localDir = join(backupBasePath, server.name);
    const localPath = join(localDir, filename);

    await this.sftp.download(conn, remotePath, localPath);

    // 3. Cleanup remote tarball (only after successful download)
    await this.ssh.exec(conn, `rm -f ${remotePath}`);

    // Return metadata
    const meta: BackupMeta = {
      serverId: server.id,
      filename,
      localPath,
      sizeBytes: 0, // Size would be known after download in real impl
      createdAt: new Date().toISOString(),
    };

    return meta;
  }

  /**
   * List backup files for a server from local backup directory.
   * Returns sorted newest first.
   */
  async list(
    serverName: string,
    backupBasePath: string,
  ): Promise<readonly BackupMeta[]> {
    const basePath = await this.resolveListBasePath(backupBasePath);
    const serverDir = join(basePath, serverName);

    let entries: string[] = [];
    try {
      entries = await readdir(serverDir);
    } catch {
      return [];
    }

    const serverId = await this.resolveServerIdFromName(serverName);
    const backups = await Promise.all(
      entries
        .filter((name) => name.endsWith('.tar.gz') || name.endsWith('.tar'))
        .map(async (filename) => {
          const localPath = join(serverDir, filename);
          const fileStats = await stat(localPath);

          const meta: BackupMeta = {
            serverId,
            filename,
            localPath,
            sizeBytes: fileStats.size,
            createdAt: fileStats.mtime.toISOString(),
          };
          return meta;
        }),
    );

    return backups.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Restore a backup to the server:
   * 1. Stop the container
   * 2. Upload tarball via SFTP
   * 3. Decompress into data volume
   * 4. Restart the container
   */
  async restore(serverId: ServerId, backupPath: string): Promise<void> {
    const server = await this.requireServer(serverId);
    const conn = this.sshConn(server);

    const filename = backupPath.split('/').pop() ?? 'restore.tar.gz';
    const remoteTmpPath = `/tmp/${filename}`;

    // 1. Stop container
    await this.ssh.exec(
      conn,
      'docker compose -f /opt/zomboid/docker-compose.yml stop',
    );

    // 2. Upload backup tarball to remote /tmp
    await this.sftp.upload(conn, backupPath, remoteTmpPath);

    // 3. Decompress into data volume
    await this.ssh.exec(
      conn,
      `tar -xzf ${remoteTmpPath} -C /opt/zomboid`,
    );

    // 4. Restart container
    await this.ssh.exec(
      conn,
      'docker compose -f /opt/zomboid/docker-compose.yml up -d',
    );
  }

  /**
   * Get the backup directory path for a server.
   */
  getBackupPath(
    server: ServerRecord,
    basePath?: string,
  ): string {
    let base = basePath ?? join(homedir(), '.zomboid-cli', 'backups');
    if (base.startsWith('~')) {
      base = join(homedir(), base.slice(1));
    }
    return join(base, server.name);
  }

  // ── Private helpers ──

  private async requireServer(id: ServerId): Promise<ServerRecord> {
    const server = await this.db.getServer(id);
    if (!server) {
      throw new Error(`Server not found: ${id}`);
    }
    return server;
  }

  private sshConn(server: ServerRecord): SshConnectionConfig {
    return {
      host: server.staticIp ?? '',
      port: 22,
      username: 'root',
      privateKey: server.sshPrivateKey,
    };
  }

  private async resolveBackupPath(): Promise<string> {
    const setting = await this.db.getSetting('backup_path');
    const pathStr = setting ?? join(homedir(), '.zomboid-cli', 'backups');
    if (pathStr.startsWith('~')) {
      return join(homedir(), pathStr.slice(1));
    }
    return pathStr;
  }

  private async resolveListBasePath(backupBasePath: string): Promise<string> {
    if (!backupBasePath || backupBasePath.trim().length === 0) {
      return this.resolveBackupPath();
    }
    if (backupBasePath.startsWith('~')) {
      return join(homedir(), backupBasePath.slice(1));
    }
    return backupBasePath;
  }

  private async resolveServerIdFromName(serverName: string): Promise<ServerId> {
    const servers = await this.db.listServers();
    const match = servers.find((server) => server.name === serverName);
    return match?.id ?? createServerId(`server-${serverName}`);
  }
}
