import { describe, it, expect, beforeEach } from 'bun:test';
import { createServerStore, type ServerStore } from '@/presentation/store/server-store.ts';
import type { ServerId, ServerRecord } from '@/domain/entities/index.ts';
import { createServerId } from '@/domain/entities/index.ts';

function makeServer(overrides: Partial<ServerRecord> & { id: ServerId; name: string }): ServerRecord {
  return {
    provider: 'gcp',
    projectId: 'proj-1',
    instanceType: 'e2-standard-2',
    instanceZone: 'us-central1-a',
    staticIp: null,
    sshPrivateKey: 'key',
    rconPassword: 'pass',
    gameBranch: 'stable',
    status: 'running',
    errorMessage: null,
    backupPath: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as ServerRecord;
}

describe('ServerStore — Hydrate / Invalidation', () => {
  let store: ServerStore;

  beforeEach(() => {
    store = createServerStore();
  });

  describe('hydrateActive / hydrateArchived', () => {
    it('should populate active servers list', () => {
      const activeServers = [
        makeServer({ id: createServerId('s1'), name: 'Alpha', status: 'running' }),
        makeServer({ id: createServerId('s2'), name: 'Beta', status: 'stopped' }),
      ];
      store.getState().hydrateActive(activeServers as never);
      expect(store.getState().active).toHaveLength(2);
    });

    it('should populate archived servers list', () => {
      const archivedServers = [
        makeServer({ id: createServerId('s3'), name: 'Gamma', status: 'archived' }),
      ];
      store.getState().hydrateArchived(archivedServers as never);
      expect(store.getState().archived).toHaveLength(1);
    });

    it('should separate active from archived', () => {
      const activeServers = [makeServer({ id: createServerId('s1'), name: 'Alpha', status: 'running' })];
      const archivedServers = [makeServer({ id: createServerId('s2'), name: 'Beta', status: 'archived' })];

      store.getState().hydrateActive(activeServers as never);
      store.getState().hydrateArchived(archivedServers as never);

      expect(store.getState().active).toHaveLength(1);
      expect(store.getState().archived).toHaveLength(1);
    });
  });

  describe('invalidationToken', () => {
    it('should start at 0', () => {
      expect(store.getState().invalidationToken).toBe(0);
    });

    it('should increment on invalidate(reason)', async () => {
      await store.getState().invalidate('deploy');
      expect(store.getState().invalidationToken).toBe(1);
    });

    it('should increment regardless of reason', async () => {
      await store.getState().invalidate('stop');
      await store.getState().invalidate('start');
      expect(store.getState().invalidationToken).toBe(2);
    });
  });

  describe('updateOne affects active and archived', () => {
    it('should update server in active list', () => {
      const id = createServerId('s1');
      store.getState().hydrateActive([makeServer({ id, name: 'Alpha', status: 'running' })]);
      store.getState().updateOne(id, { status: 'stopped' });
      expect(store.getState().active[0]!.status).toBe('stopped');
    });
  });
});
