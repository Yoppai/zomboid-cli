import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { ISshGateway, CommandResult } from '@/shared/infra/contracts/i-ssh-gateway.ts';
import type { ISftpGateway } from '@/shared/infra/contracts/i-sftp-gateway.ts';
import type { ILocalDb } from '@/shared/infra/contracts/i-local-db.ts';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { ServerId, ServerStatus } from '@/shared/infra/entities/enums.ts';
import type { SshConnectionConfig, BackupMeta } from '@/shared/infra/entities/value-objects.ts';
import { createServerId } from '@/shared/infra/entities/enums.ts';
import { mkdtemp, mkdir, writeFile, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Production code that does NOT exist yet — guarantees RED
import { BackupService } from '@/features/backups/services/backup-service.ts';

// ── Helpers ──

function makeServerRecord(overrides: Partial<ServerRecord> = {}): ServerRecord {
  return {
    id: createServerId('srv-001'),
    name: 'test-server',
    provider: 'gcp',
    projectId: 'my-project',
    instanceType: 'e2-standard-2',
    instanceZone: 'us-central1-a',
    staticIp: '34.120.5.1',
    sshPrivateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
    rconPassword: 'abc123def456',
    gameBranch: 'stable',
    status: 'running' as ServerStatus,
    errorMessage: null,
    backupPath: null,
    createdAt: '2026-04-15T10:00:00Z',
    updatedAt: '2026-04-15T10:00:00Z',
    ...overrides,
  };
}

function createMockSsh(overrides: Partial<ISshGateway> = {}): ISshGateway {
  return {
    exec: mock(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
    execStream: mock(async () => {}),
    createTunnel: mock(async () => ({ close: mock(() => {}) })),
    testConnection: mock(async () => true),
    disconnect: mock(async () => {}),
    disconnectAll: mock(async () => {}),
    ...overrides,
  };
}

function createMockSftp(overrides: Partial<ISftpGateway> = {}): ISftpGateway {
  return {
    upload: mock(async () => {}),
    download: mock(async () => {}),
    listRemote: mock(async () => []),
    exists: mock(async () => true),
    ...overrides,
  };
}

function createMockDb(overrides: Partial<ILocalDb> = {}): ILocalDb {
  return {
    createServer: mock(async () => {}),
    getServer: mock(async () => null),
    listServers: mock(async () => []),
    updateServer: mock(async () => {}),
    deleteServer: mock(async () => {}),
    createTask: mock(async () => {}),
    getTask: mock(async () => null),
    listTasks: mock(async () => []),
    updateTask: mock(async () => {}),
    deleteTask: mock(async () => {}),
    deleteTasksByServer: mock(async () => {}),
    getSetting: mock(async () => null),
    setSetting: mock(async () => {}),
    close: mock(() => {}),
    ...overrides,
  };
}

/** Normalize path separators for cross-platform assertions */
function normPath(p: string): string {
  return p.replace(/\\/g, '/');
}

// ── Tests ──

describe('BackupService', () => {
  let ssh: ISshGateway;
  let sftp: ISftpGateway;
  let db: ILocalDb;
  let svc: BackupService;

  beforeEach(() => {
    ssh = createMockSsh();
    sftp = createMockSftp();
    db = createMockDb();
    svc = new BackupService(ssh, sftp, db);
  });

  // ── create ──

  describe('create', () => {
    it('should execute tar compression on the remote VM via SSH', async () => {
      const server = makeServerRecord();
      const capturedCommands: string[] = [];

      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string) => {
          capturedCommands.push(cmd);
          return { stdout: '', stderr: '', exitCode: 0 };
        }),
      });
      db = createMockDb({
        getServer: mock(async () => server),
        getSetting: mock(async () => '~/.zomboid-cli/backups'),
      });
      svc = new BackupService(ssh, sftp, db);

      await svc.create(server.id);

      // First SSH command should be the tar compression
      const tarCmd = capturedCommands.find((c) => c.includes('tar'));
      expect(tarCmd).toBeDefined();
      expect(tarCmd!).toContain('-czf');
      expect(tarCmd!).toContain('/opt/zomboid');
    });

    it('should download backup via SFTP then cleanup remote file', async () => {
      const callOrder: string[] = [];
      const server = makeServerRecord();

      sftp = createMockSftp({
        download: mock(async () => {
          callOrder.push('download');
        }),
      });
      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string) => {
          if (cmd.includes('tar') && cmd.includes('-czf')) callOrder.push('tar');
          if (cmd.includes('rm')) callOrder.push('cleanup');
          return { stdout: '', stderr: '', exitCode: 0 };
        }),
      });
      db = createMockDb({
        getServer: mock(async () => server),
        getSetting: mock(async () => '~/.zomboid-cli/backups'),
      });
      svc = new BackupService(ssh, sftp, db);

      await svc.create(server.id);

      // Verify order: tar → download → cleanup
      expect(callOrder).toEqual(['tar', 'download', 'cleanup']);
    });

    it('should return BackupMeta with correct serverId and filename', async () => {
      const server = makeServerRecord();

      db = createMockDb({
        getServer: mock(async () => server),
        getSetting: mock(async () => '~/.zomboid-cli/backups'),
      });
      svc = new BackupService(ssh, sftp, db);

      const meta = await svc.create(server.id);

      expect(meta.serverId).toBe(server.id);
      expect(meta.filename).toContain('zomboid-backup-');
      expect(meta.filename).toContain('.tar.gz');
      expect(normPath(meta.localPath)).toContain('test-server');
    });

    it('should use backup path from settings', async () => {
      const server = makeServerRecord({ name: 'custom-srv' });
      let downloadLocalPath = '';

      sftp = createMockSftp({
        download: mock(async (_conn: SshConnectionConfig, _remote: string, local: string) => {
          downloadLocalPath = local;
        }),
      });
      db = createMockDb({
        getServer: mock(async () => server),
        getSetting: mock(async (key: string) =>
          key === 'backup_path' ? '/custom/backups' : null,
        ),
      });
      svc = new BackupService(ssh, sftp, db);

      await svc.create(server.id);

      const normalized = normPath(downloadLocalPath);
      expect(normalized).toContain('custom/backups');
      expect(normalized).toContain('custom-srv');
    });

    it('should NOT cleanup remote if download fails', async () => {
      const server = makeServerRecord();
      let cleanupCalled = false;

      sftp = createMockSftp({
        download: mock(async () => {
          throw new Error('Download failed');
        }),
      });
      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string) => {
          if (cmd.includes('rm')) cleanupCalled = true;
          return { stdout: '', stderr: '', exitCode: 0 };
        }),
      });
      db = createMockDb({
        getServer: mock(async () => server),
        getSetting: mock(async () => '~/.zomboid-cli/backups'),
      });
      svc = new BackupService(ssh, sftp, db);

      await expect(svc.create(server.id)).rejects.toThrow('Download failed');

      // Remote file should be preserved for manual recovery
      expect(cleanupCalled).toBe(false);
    });
  });

  // ── list ──

  describe('list', () => {
    it('should return empty when backup directory does not exist', async () => {
      const backups = await svc.list('missing-server', '/path/that/does/not/exist');
      expect(backups).toEqual([]);
    });

    it('should read real backup files and sort newest first by timestamp', async () => {
      const tempRoot = await mkdtemp(join(tmpdir(), 'zomboid-backup-list-'));
      const serverName = 'test-server';
      const serverDir = join(tempRoot, serverName);
      await mkdir(serverDir, { recursive: true });

      const oldName = 'zomboid-backup-2026-04-10T10-00-00-000Z.tar.gz';
      const newName = 'zomboid-backup-2026-04-12T10-00-00-000Z.tar.gz';

      const oldPath = join(serverDir, oldName);
      const newPath = join(serverDir, newName);

      await writeFile(oldPath, Buffer.alloc(10));
      await writeFile(newPath, Buffer.alloc(20));

      const oldDate = new Date('2026-04-10T10:00:00.000Z');
      const newDate = new Date('2026-04-12T10:00:00.000Z');
      await utimes(oldPath, oldDate, oldDate);
      await utimes(newPath, newDate, newDate);

      try {
        const backups = await svc.list(serverName, tempRoot);

        expect(backups).toHaveLength(2);
        expect(backups[0]?.filename).toBe(newName);
        expect(backups[1]?.filename).toBe(oldName);
        expect(backups[0]?.sizeBytes).toBe(20);
        expect(backups[1]?.sizeBytes).toBe(10);
        expect(backups[0]?.createdAt).toBe('2026-04-12T10:00:00.000Z');
        expect(backups[1]?.createdAt).toBe('2026-04-10T10:00:00.000Z');
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    });
  });

  // ── restore ──

  describe('restore', () => {
    it('should execute restore flow: stop → upload → decompress → start', async () => {
      const callOrder: string[] = [];
      const server = makeServerRecord();

      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string) => {
          if (cmd.includes('docker compose') && cmd.includes('stop')) callOrder.push('stop');
          if (cmd.includes('tar') && cmd.includes('-xzf')) callOrder.push('decompress');
          if (cmd.includes('docker compose') && cmd.includes('up')) callOrder.push('start');
          return { stdout: '', stderr: '', exitCode: 0 };
        }),
      });
      sftp = createMockSftp({
        upload: mock(async () => {
          callOrder.push('upload');
        }),
      });
      db = createMockDb({
        getServer: mock(async () => server),
      });
      svc = new BackupService(ssh, sftp, db);

      await svc.restore(server.id, '/backups/test-server/backup-20260415.tar.gz');

      expect(callOrder).toEqual(['stop', 'upload', 'decompress', 'start']);
    });

    it('should upload to /tmp on remote before decompressing', async () => {
      const server = makeServerRecord();
      let uploadRemotePath = '';

      sftp = createMockSftp({
        upload: mock(async (_conn: SshConnectionConfig, _local: string, remote: string) => {
          uploadRemotePath = remote;
        }),
      });
      db = createMockDb({
        getServer: mock(async () => server),
      });
      svc = new BackupService(ssh, sftp, db);

      await svc.restore(server.id, '/backups/test-server/backup.tar.gz');

      expect(uploadRemotePath).toContain('/tmp/');
    });
  });

  // ── getBackupPath ──

  describe('getBackupPath', () => {
    it('should construct path from backup base and server name', () => {
      const server = makeServerRecord({ name: 'my-zomboid' });

      const path = svc.getBackupPath(server, '/home/user/.zomboid-cli/backups');
      const normalized = normPath(path);

      expect(normalized).toContain('my-zomboid');
      expect(normalized).toContain('home/user/.zomboid-cli/backups');
    });

    it('should use default path when no custom path provided', () => {
      const server = makeServerRecord({ name: 'default-srv' });

      const path = svc.getBackupPath(server);
      const normalized = normPath(path);

      expect(normalized).toContain('default-srv');
      expect(normalized).toContain('.zomboid-cli/backups');
    });
  });
});
