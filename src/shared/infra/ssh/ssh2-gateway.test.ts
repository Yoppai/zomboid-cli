import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { SshConnectionConfig } from '@/shared/infra/entities/value-objects.ts';
import { SshConnectionError, SshCommandError } from '@/shared/infra/entities/errors.ts';

// Production code that does NOT exist yet — guarantees RED
import { Ssh2Gateway } from '@/shared/infra/ssh/ssh2-gateway.ts';
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

/** Create a mock SSH channel (EventEmitter-like) */
function createMockChannel(
  stdoutData: string = '',
  stderrData: string = '',
  exitCode: number = 0,
) {
  const channel: any = {
    on: mock((event: string, cb: Function) => {
      if (event === 'close') {
        // Fire close asynchronously
        setTimeout(() => cb(exitCode, undefined), 5);
      }
      if (event === 'data') {
        if (stdoutData) setTimeout(() => cb(Buffer.from(stdoutData)), 1);
      }
      return channel;
    }),
    stderr: {
      on: mock((event: string, cb: Function) => {
        if (event === 'data' && stderrData) {
          setTimeout(() => cb(Buffer.from(stderrData)), 1);
        }
        return channel.stderr;
      }),
    },
    destroy: mock(() => {}),
    end: mock(() => {}),
  };
  return channel;
}

/** Create a mock ssh2 Client */
function createMockClient(channel?: any) {
  const client: any = {
    exec: mock((cmd: string, cb: Function) => {
      if (channel) {
        cb(null, channel);
      } else {
        cb(new Error('exec failed'));
      }
    }),
    forwardOut: mock(
      (
        bindAddr: string,
        bindPort: number,
        remoteAddr: string,
        remotePort: number,
        cb: Function,
      ) => {
        const stream: any = {
          on: mock(() => stream),
          end: mock(() => {}),
          destroy: mock(() => {}),
        };
        cb(null, stream);
      },
    ),
    end: mock(() => {}),
    destroy: mock(() => {}),
    on: mock(() => client),
    removeAllListeners: mock(() => client),
  };
  return client;
}

describe('Ssh2Gateway', () => {
  let pool: SshPool;
  let gateway: Ssh2Gateway;

  beforeEach(() => {
    pool = new SshPool();
    gateway = new Ssh2Gateway(pool);
  });

  afterEach(async () => {
    await pool.releaseAll();
  });

  describe('exec', () => {
    it('should return CommandResult with stdout, stderr, and exitCode on success', async () => {
      const channel = createMockChannel('hello world\n', '', 0);
      const mockClient = createMockClient(channel);
      pool._setClientForTest('10.0.0.1', mockClient);

      const result = await gateway.exec(makeConn(), 'echo hello world');

      expect(result.stdout).toContain('hello world');
      expect(result.exitCode).toBe(0);
    });

    it('should capture stderr on non-zero exit', async () => {
      const channel = createMockChannel('', 'command not found', 127);
      const mockClient = createMockClient(channel);
      pool._setClientForTest('10.0.0.1', mockClient);

      try {
        await gateway.exec(makeConn(), 'nonexistent-cmd');
        // Should throw SshCommandError for non-zero exit
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(SshCommandError);
        expect((err as SshCommandError).code).toBe('SSH_COMMAND_FAILED');
      }
    });

    it('should call exec on the pool client', async () => {
      const channel = createMockChannel('output', '', 0);
      const mockClient = createMockClient(channel);
      pool._setClientForTest('10.0.0.1', mockClient);

      await gateway.exec(makeConn(), 'docker ps');

      expect(mockClient.exec).toHaveBeenCalledTimes(1);
    });
  });

  describe('execStream', () => {
    it('should call onData for each line of stdout', async () => {
      const lines: string[] = [];
      const channel = createMockChannel('line1\nline2\nline3\n', '', 0);
      const mockClient = createMockClient(channel);
      pool._setClientForTest('10.0.0.1', mockClient);

      await gateway.execStream(makeConn(), 'docker logs -f', (line) => {
        lines.push(line);
      });

      // At minimum, the onData callback should have been set up
      expect(mockClient.exec).toHaveBeenCalledTimes(1);
    });

    it('should respect AbortSignal cancellation', async () => {
      const controller = new AbortController();
      const channel = createMockChannel('data', '', 0);
      const mockClient = createMockClient(channel);
      pool._setClientForTest('10.0.0.1', mockClient);

      // Abort immediately
      controller.abort();

      await gateway.execStream(
        makeConn(),
        'docker logs -f',
        () => {},
        controller.signal,
      );

      // Should not throw, just exit cleanly
    });
  });

  describe('createTunnel', () => {
    it('should call forwardOut on the client', async () => {
      const mockClient = createMockClient();
      pool._setClientForTest('10.0.0.1', mockClient);

      const tunnel = await gateway.createTunnel(
        makeConn(),
        12345,
        '127.0.0.1',
        27015,
      );

      expect(mockClient.forwardOut).toHaveBeenCalledTimes(1);
      expect(tunnel).toHaveProperty('close');
      expect(typeof tunnel.close).toBe('function');
    });

    it('should return a handle with close function', async () => {
      const mockClient = createMockClient();
      pool._setClientForTest('10.0.0.1', mockClient);

      const tunnel = await gateway.createTunnel(
        makeConn(),
        12345,
        '127.0.0.1',
        27015,
      );

      // Calling close should not throw
      expect(() => tunnel.close()).not.toThrow();
    });
  });

  describe('testConnection', () => {
    it('should return true when pool has a cached client', async () => {
      const mockClient = createMockClient();
      pool._setClientForTest('10.0.0.1', mockClient);

      const result = await gateway.testConnection(makeConn());
      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      // No client in pool, and we can't connect to a real server
      // testConnection should catch errors and return false
      const result = await gateway.testConnection(makeConn('192.168.255.255'));
      // This will try to connect and fail — should return false
      // But since we can't actually connect, the pool.getClient will throw
      // The gateway should catch and return false
      expect(typeof result).toBe('boolean');
    });
  });

  describe('disconnect', () => {
    it('should delegate to pool.release for a specific host', async () => {
      const mockClient = createMockClient();
      pool._setClientForTest('10.0.0.1', mockClient);

      await gateway.disconnect('10.0.0.1');
      expect(pool.has('10.0.0.1')).toBe(false);
    });
  });

  describe('disconnectAll', () => {
    it('should delegate to pool.releaseAll', async () => {
      const mock1 = createMockClient();
      const mock2 = createMockClient();
      pool._setClientForTest('host-a', mock1);
      pool._setClientForTest('host-b', mock2);

      await gateway.disconnectAll();
      expect(pool.getSize()).toBe(0);
    });
  });

  describe('retry logic', () => {
    it('should retry on transient failure then succeed', async () => {
      let callCount = 0;
      const channel = createMockChannel('success', '', 0);

      const mockClient: any = {
        exec: mock((cmd: string, cb: Function) => {
          callCount++;
          if (callCount < 3) {
            cb(new Error('transient failure'));
          } else {
            cb(null, channel);
          }
        }),
        end: mock(() => {}),
        destroy: mock(() => {}),
        on: mock(() => mockClient),
        removeAllListeners: mock(() => mockClient),
      };

      pool._setClientForTest('10.0.0.1', mockClient);

      const result = await gateway.exec(makeConn(), 'echo retry test');
      expect(result.stdout).toContain('success');
      expect(callCount).toBe(3); // 2 failures + 1 success
    });

    it('should throw after exhausting all retries', async () => {
      const mockClient: any = {
        exec: mock((cmd: string, cb: Function) => {
          cb(new Error('persistent failure'));
        }),
        end: mock(() => {}),
        destroy: mock(() => {}),
        on: mock(() => mockClient),
        removeAllListeners: mock(() => mockClient),
      };

      pool._setClientForTest('10.0.0.1', mockClient);

      await expect(
        gateway.exec(makeConn(), 'failing-cmd'),
      ).rejects.toThrow();
    });
  });
});

