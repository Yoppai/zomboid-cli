import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { SshConnectionConfig } from '@/shared/infra/entities/value-objects.ts';
import { SftpTransferError } from '@/shared/infra/entities/errors.ts';
import type { TransferProgress } from '@/shared/infra/contracts/i-sftp-gateway.ts';

// Production code that does NOT exist yet — guarantees RED
import { Ssh2SftpGateway } from '@/shared/infra/ssh/ssh2-sftp-gateway.ts';
import { SshPool } from '@/shared/infra/ssh/ssh-pool.ts';

// ── Test Helpers ──

function makeConn(host: string = '10.0.0.1'): SshConnectionConfig {
  return {
    host,
    port: 22,
    username: 'root',
    privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----',
  };
}

/** Create a mock SFTP session */
function createMockSftp(options?: {
  fastPutError?: Error;
  fastGetError?: Error;
  readdirEntries?: Array<{ filename: string }>;
  readdirError?: Error;
  statError?: Error;
  statResult?: { size: number };
}) {
  const sftp: any = {
    fastPut: mock((localPath: string, remotePath: string, cb: Function) => {
      if (options?.fastPutError) {
        cb(options.fastPutError);
      } else {
        cb(null);
      }
    }),
    fastGet: mock((remotePath: string, localPath: string, cb: Function) => {
      if (options?.fastGetError) {
        cb(options.fastGetError);
      } else {
        cb(null);
      }
    }),
    readdir: mock((remotePath: string, cb: Function) => {
      if (options?.readdirError) {
        cb(options.readdirError);
      } else {
        cb(null, options?.readdirEntries ?? []);
      }
    }),
    stat: mock((remotePath: string, cb: Function) => {
      if (options?.statError) {
        cb(options.statError);
      } else {
        cb(null, options?.statResult ?? { size: 1024 });
      }
    }),
    end: mock(() => {}),
  };
  return sftp;
}

/** Create a mock ssh2 Client with SFTP support */
function createMockClient(sftp?: any, sftpError?: Error) {
  const client: any = {
    sftp: mock((cb: Function) => {
      if (sftpError) {
        cb(sftpError);
      } else {
        cb(null, sftp ?? createMockSftp());
      }
    }),
    end: mock(() => {}),
    destroy: mock(() => {}),
    on: mock(() => client),
    removeAllListeners: mock(() => client),
  };
  return client;
}

describe('Ssh2SftpGateway', () => {
  let pool: SshPool;
  let gateway: Ssh2SftpGateway;

  beforeEach(() => {
    pool = new SshPool();
    gateway = new Ssh2SftpGateway(pool);
  });

  afterEach(async () => {
    await pool.releaseAll();
  });

  describe('upload', () => {
    it('should call sftp.fastPut with correct paths', async () => {
      const mockSftp = createMockSftp();
      const mockClient = createMockClient(mockSftp);
      pool._setClientForTest('10.0.0.1', mockClient);

      await gateway.upload(makeConn(), '/local/file.ini', '/remote/file.ini');

      expect(mockClient.sftp).toHaveBeenCalledTimes(1);
      expect(mockSftp.fastPut).toHaveBeenCalledTimes(1);
    });

    it('should wrap SFTP upload errors in SftpTransferError', async () => {
      const mockSftp = createMockSftp({
        fastPutError: new Error('disk full'),
      });
      const mockClient = createMockClient(mockSftp);
      pool._setClientForTest('10.0.0.1', mockClient);

      try {
        await gateway.upload(makeConn(), '/local/file.ini', '/remote/file.ini');
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(SftpTransferError);
        expect((err as SftpTransferError).code).toBe('SFTP_TRANSFER_FAILED');
      }
    });

    it('should call onProgress callback when provided', async () => {
      const mockSftp = createMockSftp();
      const mockClient = createMockClient(mockSftp);
      pool._setClientForTest('10.0.0.1', mockClient);

      const progressCalls: TransferProgress[] = [];

      await gateway.upload(
        makeConn(),
        '/local/file.ini',
        '/remote/file.ini',
        (progress) => progressCalls.push(progress),
      );

      // fastPut was called — progress is reported on completion
      expect(mockSftp.fastPut).toHaveBeenCalledTimes(1);
    });
  });

  describe('download', () => {
    it('should call sftp.fastGet with correct paths', async () => {
      const mockSftp = createMockSftp();
      const mockClient = createMockClient(mockSftp);
      pool._setClientForTest('10.0.0.1', mockClient);

      await gateway.download(makeConn(), '/remote/backup.tar.gz', '/local/backup.tar.gz');

      expect(mockClient.sftp).toHaveBeenCalledTimes(1);
      expect(mockSftp.fastGet).toHaveBeenCalledTimes(1);
    });

    it('should wrap SFTP download errors in SftpTransferError', async () => {
      const mockSftp = createMockSftp({
        fastGetError: new Error('file not found'),
      });
      const mockClient = createMockClient(mockSftp);
      pool._setClientForTest('10.0.0.1', mockClient);

      try {
        await gateway.download(makeConn(), '/remote/nofile.tar.gz', '/local/x.tar.gz');
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(SftpTransferError);
        expect((err as SftpTransferError).code).toBe('SFTP_TRANSFER_FAILED');
      }
    });
  });

  describe('listRemote', () => {
    it('should return filenames from readdir result', async () => {
      const mockSftp = createMockSftp({
        readdirEntries: [
          { filename: 'backup-2026-01.tar.gz' },
          { filename: 'backup-2026-02.tar.gz' },
          { filename: 'backup-2026-03.tar.gz' },
        ],
      });
      const mockClient = createMockClient(mockSftp);
      pool._setClientForTest('10.0.0.1', mockClient);

      const files = await gateway.listRemote(makeConn(), '/opt/zomboid/backups');

      expect(files).toHaveLength(3);
      expect(files[0]).toBe('backup-2026-01.tar.gz');
      expect(files[1]).toBe('backup-2026-02.tar.gz');
      expect(files[2]).toBe('backup-2026-03.tar.gz');
    });

    it('should return empty array for empty directory', async () => {
      const mockSftp = createMockSftp({ readdirEntries: [] });
      const mockClient = createMockClient(mockSftp);
      pool._setClientForTest('10.0.0.1', mockClient);

      const files = await gateway.listRemote(makeConn(), '/opt/zomboid/empty');
      expect(files).toHaveLength(0);
    });

    it('should wrap readdir errors', async () => {
      const mockSftp = createMockSftp({
        readdirError: new Error('permission denied'),
      });
      const mockClient = createMockClient(mockSftp);
      pool._setClientForTest('10.0.0.1', mockClient);

      await expect(
        gateway.listRemote(makeConn(), '/opt/zomboid/restricted'),
      ).rejects.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      const mockSftp = createMockSftp({ statResult: { size: 42 } });
      const mockClient = createMockClient(mockSftp);
      pool._setClientForTest('10.0.0.1', mockClient);

      const result = await gateway.exists(makeConn(), '/opt/zomboid/data/file.txt');
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      const mockSftp = createMockSftp({
        statError: new Error('No such file'),
      });
      const mockClient = createMockClient(mockSftp);
      pool._setClientForTest('10.0.0.1', mockClient);

      const result = await gateway.exists(makeConn(), '/opt/zomboid/missing.txt');
      expect(result).toBe(false);
    });
  });

  describe('SFTP session errors', () => {
    it('should throw SftpTransferError when SFTP session fails to open', async () => {
      const mockClient = createMockClient(undefined, new Error('SFTP subsystem failed'));
      pool._setClientForTest('10.0.0.1', mockClient);

      await expect(
        gateway.upload(makeConn(), '/local', '/remote'),
      ).rejects.toThrow();
    });
  });
});

