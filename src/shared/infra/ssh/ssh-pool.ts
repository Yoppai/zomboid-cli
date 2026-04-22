import { Client } from 'ssh2';
import type { SshConnectionConfig } from '../entities/value-objects.ts';
import { SshConnectionError } from '../entities/errors.ts';

// ── Pool Entry ──

interface PoolEntry {
  client: Client;
  lastUsed: number;
}

// ── SSH Connection Pool ──

const DEFAULT_READY_TIMEOUT = 10_000;
const DEFAULT_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export class SshPool {
  private readonly pool = new Map<string, PoolEntry>();
  private readonly idleTimeout: number;

  constructor(options?: { idleTimeout?: number }) {
    this.idleTimeout = options?.idleTimeout ?? DEFAULT_IDLE_TIMEOUT;
  }

  /**
   * Get or create an SSH client for the given connection config.
   * Reuses cached connections by host key.
   */
  async getClient(conn: SshConnectionConfig): Promise<Client> {
    const key = conn.host;
    const existing = this.pool.get(key);

    if (existing) {
      existing.lastUsed = Date.now();
      return existing.client;
    }

    const client = await this.createClient(conn);
    this.pool.set(key, { client, lastUsed: Date.now() });
    return client;
  }

  /**
   * Get a cached client without creating a new connection.
   * Returns null if no cached client exists for the host.
   * Updates lastUsed timestamp on access.
   */
  getCachedClient(host: string): Client | null {
    const entry = this.pool.get(host);
    if (!entry) return null;
    entry.lastUsed = Date.now();
    return entry.client;
  }

  /**
   * Release (disconnect) a specific host's connection.
   */
  async release(host: string): Promise<void> {
    const entry = this.pool.get(host);
    if (!entry) return;

    try {
      entry.client.end();
    } catch {
      // Ignore errors on cleanup
    }
    this.pool.delete(host);
  }

  /**
   * Release all pooled connections.
   */
  async releaseAll(): Promise<void> {
    for (const [host] of this.pool) {
      await this.release(host);
    }
  }

  /**
   * Check if a host has a cached connection.
   */
  has(host: string): boolean {
    return this.pool.has(host);
  }

  /**
   * Get the number of pooled connections.
   */
  getSize(): number {
    return this.pool.size;
  }

  /**
   * Get the lastUsed timestamp for a host. Returns undefined if not found.
   */
  getLastUsed(host: string): number | undefined {
    return this.pool.get(host)?.lastUsed;
  }

  /**
   * Test helper — inject a mock client into the pool for testing.
   * @internal
   */
  _setClientForTest(host: string, client: Client): void {
    this.pool.set(host, { client, lastUsed: Date.now() });
  }

  // ── Private ──

  private createClient(conn: SshConnectionConfig): Promise<Client> {
    return new Promise<Client>((resolve, reject) => {
      const client = new Client();

      client.on('ready', () => {
        resolve(client);
      });

      client.on('error', (err) => {
        reject(new SshConnectionError(conn.host, err));
      });

      client.connect({
        host: conn.host,
        port: conn.port,
        username: conn.username,
        privateKey: conn.privateKey,
        readyTimeout: DEFAULT_READY_TIMEOUT,
      });
    });
  }
}
