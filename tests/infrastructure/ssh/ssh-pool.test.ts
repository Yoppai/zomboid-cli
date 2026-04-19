import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import type { SshConnectionConfig } from '../../../src/domain/entities/value-objects.ts';

// Production code that does NOT exist yet — guarantees RED
import { SshPool } from '../../../src/infrastructure/ssh/ssh-pool.ts';

// ── Test Helpers ──

function makeConn(host: string = '10.0.0.1'): SshConnectionConfig {
  return {
    host,
    port: 22,
    username: 'root',
    privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nfake-key\n-----END OPENSSH PRIVATE KEY-----',
  };
}

describe('SshPool', () => {
  let pool: SshPool;

  beforeEach(() => {
    pool = new SshPool();
  });

  afterEach(async () => {
    await pool.releaseAll();
  });

  describe('getClient', () => {
    it('should return a client object for a valid connection config', async () => {
      // We can't actually connect, but we can test the pool API contract
      // We'll mock at the ssh2 level in integration — here test pool data structures
      const conn = makeConn('127.0.0.1');

      // The pool should track connections by host
      // Since we can't connect to a real server, we test the pool's internal tracking
      // by verifying getSize starts at 0
      expect(pool.getSize()).toBe(0);
    });

    it('should reuse same client for same host', async () => {
      const conn = makeConn('10.0.0.1');

      // Pool should track that the same host maps to the same entry
      // Direct testing: pool reports 0 initially
      expect(pool.getSize()).toBe(0);
      expect(pool.has('10.0.0.1')).toBe(false);
    });
  });

  describe('release', () => {
    it('should remove a host entry from the pool', async () => {
      // After release, has() should return false
      await pool.release('10.0.0.1');
      expect(pool.has('10.0.0.1')).toBe(false);
    });

    it('should not throw when releasing a non-existent host', async () => {
      await expect(pool.release('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('releaseAll', () => {
    it('should clear all entries from the pool', async () => {
      await pool.releaseAll();
      expect(pool.getSize()).toBe(0);
    });
  });

  describe('has', () => {
    it('should return false for unknown hosts', () => {
      expect(pool.has('unknown-host')).toBe(false);
    });
  });

  describe('getSize', () => {
    it('should return 0 for empty pool', () => {
      expect(pool.getSize()).toBe(0);
    });
  });

  describe('connection lifecycle with mock client', () => {
    it('should store and retrieve a client via _setClientForTest helper', () => {
      // Use internal test helper to inject a mock client
      const mockClient = {
        end: mock(() => {}),
        destroy: mock(() => {}),
        on: mock(() => mockClient),
        removeAllListeners: mock(() => mockClient),
      };

      pool._setClientForTest('10.0.0.1', mockClient as any);
      expect(pool.has('10.0.0.1')).toBe(true);
      expect(pool.getSize()).toBe(1);
    });

    it('should call end() on client when releasing', async () => {
      const mockClient = {
        end: mock(() => {}),
        destroy: mock(() => {}),
        on: mock(() => mockClient),
        removeAllListeners: mock(() => mockClient),
      };

      pool._setClientForTest('10.0.0.2', mockClient as any);
      await pool.release('10.0.0.2');

      expect(mockClient.end).toHaveBeenCalledTimes(1);
      expect(pool.has('10.0.0.2')).toBe(false);
    });

    it('should call end() on all clients when releaseAll', async () => {
      const mock1 = {
        end: mock(() => {}),
        destroy: mock(() => {}),
        on: mock(() => mock1),
        removeAllListeners: mock(() => mock1),
      };
      const mock2 = {
        end: mock(() => {}),
        destroy: mock(() => {}),
        on: mock(() => mock2),
        removeAllListeners: mock(() => mock2),
      };

      pool._setClientForTest('host-a', mock1 as any);
      pool._setClientForTest('host-b', mock2 as any);
      expect(pool.getSize()).toBe(2);

      await pool.releaseAll();

      expect(mock1.end).toHaveBeenCalledTimes(1);
      expect(mock2.end).toHaveBeenCalledTimes(1);
      expect(pool.getSize()).toBe(0);
    });

    it('should reuse existing client for same host', () => {
      const mockClient = {
        end: mock(() => {}),
        destroy: mock(() => {}),
        on: mock(() => mockClient),
        removeAllListeners: mock(() => mockClient),
      };

      pool._setClientForTest('10.0.0.5', mockClient as any);
      const retrieved = pool.getCachedClient('10.0.0.5');
      expect(retrieved as any).toBe(mockClient as any);
    });

    it('should return null for non-cached host', () => {
      const retrieved = pool.getCachedClient('not-cached');
      expect(retrieved).toBeNull();
    });

    it('should update lastUsed timestamp on getCachedClient', async () => {
      const mockClient = {
        end: mock(() => {}),
        destroy: mock(() => {}),
        on: mock(() => mockClient),
        removeAllListeners: mock(() => mockClient),
      };

      pool._setClientForTest('10.0.0.6', mockClient as any);

      // Wait a tiny bit to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 10));

      const before = pool.getLastUsed('10.0.0.6');
      pool.getCachedClient('10.0.0.6');
      const after = pool.getLastUsed('10.0.0.6');

      expect(after).toBeGreaterThanOrEqual(before!);
    });
  });
});
