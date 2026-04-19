import type { Client, ClientChannel } from 'ssh2';
import type { ISshGateway, CommandResult } from '../../domain/repositories/i-ssh-gateway.ts';
import type { SshConnectionConfig } from '../../domain/entities/value-objects.ts';
import { SshConnectionError, SshCommandError } from '../../domain/entities/errors.ts';
import type { SshPool } from './ssh-pool.ts';

// ── Constants ──

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

// ── Ssh2Gateway Adapter ──

export class Ssh2Gateway implements ISshGateway {
  constructor(private readonly pool: SshPool) {}

  async exec(
    conn: SshConnectionConfig,
    command: string,
  ): Promise<CommandResult> {
    return this.withRetry(conn, async (client) => {
      return new Promise<CommandResult>((resolve, reject) => {
        client.exec(command, (err, channel) => {
          if (err) {
            reject(new SshCommandError(command, -1, err.message));
            return;
          }

          let stdout = '';
          let stderr = '';

          channel.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          channel.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });

          channel.on('close', (code: number | null) => {
            const exitCode = code ?? 0;
            if (exitCode !== 0) {
              reject(new SshCommandError(command, exitCode, stderr));
            } else {
              resolve({ stdout, stderr, exitCode });
            }
          });
        });
      });
    });
  }

  async execStream(
    conn: SshConnectionConfig,
    command: string,
    onData: (line: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted) return;

    const client = await this.getClientSafe(conn);
    if (!client) return;

    return new Promise<void>((resolve, reject) => {
      client.exec(command, (err, channel) => {
        if (err) {
          reject(new SshCommandError(command, -1, err.message));
          return;
        }

        let buffer = '';

        const cleanup = () => {
          try {
            channel.destroy();
          } catch {
            // Ignore cleanup errors
          }
          resolve();
        };

        if (signal) {
          signal.addEventListener('abort', cleanup, { once: true });
        }

        channel.on('data', (data: Buffer) => {
          if (signal?.aborted) {
            cleanup();
            return;
          }

          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.length > 0) {
              onData(line);
            }
          }
        });

        channel.on('close', () => {
          // Flush remaining buffer
          if (buffer.length > 0) {
            onData(buffer);
          }
          resolve();
        });
      });
    });
  }

  async createTunnel(
    conn: SshConnectionConfig,
    localPort: number,
    remoteHost: string,
    remotePort: number,
  ): Promise<{ close: () => void }> {
    const client = await this.getClientSafe(conn);
    if (!client) {
      throw new SshConnectionError(conn.host);
    }

    return new Promise((resolve, reject) => {
      client.forwardOut(
        '127.0.0.1',
        localPort,
        remoteHost,
        remotePort,
        (err, stream) => {
          if (err) {
            reject(new SshConnectionError(conn.host, err));
            return;
          }

          resolve({
            close: () => {
              try {
                stream.end();
                stream.destroy();
              } catch {
                // Ignore cleanup errors
              }
            },
          });
        },
      );
    });
  }

  async testConnection(conn: SshConnectionConfig): Promise<boolean> {
    try {
      const client = this.pool.getCachedClient(conn.host);
      if (client) return true;

      await this.pool.getClient(conn);
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(host: string): Promise<void> {
    await this.pool.release(host);
  }

  async disconnectAll(): Promise<void> {
    await this.pool.releaseAll();
  }

  // ── Private Helpers ──

  private async getClientSafe(conn: SshConnectionConfig): Promise<Client | null> {
    try {
      return await this.pool.getClient(conn);
    } catch {
      return this.pool.getCachedClient(conn.host);
    }
  }

  private async withRetry<T>(
    conn: SshConnectionConfig,
    operation: (client: Client) => Promise<T>,
  ): Promise<T> {
    const client = this.pool.getCachedClient(conn.host);
    if (!client) {
      // If no cached client, try to get one (may throw SshConnectionError)
      try {
        const newClient = await this.pool.getClient(conn);
        return await operation(newClient);
      } catch (err) {
        throw err instanceof SshConnectionError
          ? err
          : new SshConnectionError(conn.host, err instanceof Error ? err : undefined);
      }
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation(client);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry auth failures
        if (
          lastError.message.includes('auth') ||
          lastError.message.includes('Auth')
        ) {
          throw lastError;
        }

        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS[attempt] ?? 4000;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError ?? new SshConnectionError(conn.host);
  }
}
