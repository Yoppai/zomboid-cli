import type { Client, SFTPWrapper } from 'ssh2';
import type { ISftpGateway, TransferProgress } from '../../domain/repositories/i-sftp-gateway.ts';
import type { SshConnectionConfig } from '../../domain/entities/value-objects.ts';
import { SftpTransferError } from '../../domain/entities/errors.ts';
import type { SshPool } from './ssh-pool.ts';

// ── Ssh2SftpGateway Adapter ──

export class Ssh2SftpGateway implements ISftpGateway {
  constructor(private readonly pool: SshPool) {}

  async upload(
    conn: SshConnectionConfig,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<void> {
    const sftp = await this.openSftp(conn);

    try {
      await new Promise<void>((resolve, reject) => {
        sftp.fastPut(localPath, remotePath, (err) => {
          if (err) {
            reject(new SftpTransferError('upload', remotePath, err));
            return;
          }

          // Report completion progress
          if (onProgress) {
            onProgress({ bytesTransferred: 0, totalBytes: 0, percent: 100 });
          }

          resolve();
        });
      });
    } finally {
      sftp.end();
    }
  }

  async download(
    conn: SshConnectionConfig,
    remotePath: string,
    localPath: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<void> {
    const sftp = await this.openSftp(conn);

    try {
      await new Promise<void>((resolve, reject) => {
        sftp.fastGet(remotePath, localPath, (err) => {
          if (err) {
            reject(new SftpTransferError('download', remotePath, err));
            return;
          }

          if (onProgress) {
            onProgress({ bytesTransferred: 0, totalBytes: 0, percent: 100 });
          }

          resolve();
        });
      });
    } finally {
      sftp.end();
    }
  }

  async listRemote(
    conn: SshConnectionConfig,
    remotePath: string,
  ): Promise<readonly string[]> {
    const sftp = await this.openSftp(conn);

    try {
      return await new Promise<readonly string[]>((resolve, reject) => {
        sftp.readdir(remotePath, (err, list) => {
          if (err) {
            reject(new SftpTransferError('download', remotePath, err));
            return;
          }

          resolve(list.map((entry) => entry.filename));
        });
      });
    } finally {
      sftp.end();
    }
  }

  async exists(
    conn: SshConnectionConfig,
    remotePath: string,
  ): Promise<boolean> {
    const sftp = await this.openSftp(conn);

    try {
      return await new Promise<boolean>((resolve) => {
        sftp.stat(remotePath, (err) => {
          resolve(!err);
        });
      });
    } finally {
      sftp.end();
    }
  }

  // ── Private ──

  private async openSftp(conn: SshConnectionConfig): Promise<SFTPWrapper> {
    const client = this.pool.getCachedClient(conn.host);
    if (!client) {
      try {
        const newClient = await this.pool.getClient(conn);
        return await this.clientSftp(newClient, conn);
      } catch (err) {
        throw new SftpTransferError(
          'upload',
          conn.host,
          err instanceof Error ? err : undefined,
        );
      }
    }

    return this.clientSftp(client, conn);
  }

  private clientSftp(client: Client, conn: SshConnectionConfig): Promise<SFTPWrapper> {
    return new Promise<SFTPWrapper>((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(
            new SftpTransferError(
              'upload',
              conn.host,
              err,
            ),
          );
          return;
        }
        resolve(sftp);
      });
    });
  }
}
