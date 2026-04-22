import type { SshConnectionConfig } from '../entities/value-objects.ts';

// ── Transfer Progress ──

export interface TransferProgress {
  readonly bytesTransferred: number;
  readonly totalBytes: number;
  readonly percent: number;
}

// ── SFTP Gateway Port ──

export interface ISftpGateway {
  /** Upload local file to remote path */
  upload(
    conn: SshConnectionConfig,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<void>;

  /** Download remote file to local path */
  download(
    conn: SshConnectionConfig,
    remotePath: string,
    localPath: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<void>;

  /** List files in remote directory */
  listRemote(
    conn: SshConnectionConfig,
    remotePath: string,
  ): Promise<readonly string[]>;

  /** Check if remote file exists */
  exists(
    conn: SshConnectionConfig,
    remotePath: string,
  ): Promise<boolean>;
}
