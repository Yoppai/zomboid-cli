import { describe, it, expect, beforeEach } from 'bun:test';
import {
  createServerStore,
  type ServerStore,
} from '@/features/server-dashboard/model/server-store';
import type { ServerRecord, ServerId } from '@/shared/infra/entities/index.ts';
import { createServerId } from '@/shared/infra/entities/index.ts';

// ── Helpers ──

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
  };
}

describe('ServerStore', () => {
  let store: ServerStore;

  beforeEach(() => {
    store = createServerStore();
  });

  // ── Initial State ──

  describe('initial state', () => {
    it('should start with empty servers and null activeServerId', () => {
      const state = store.getState();
      expect(state.servers).toEqual([]);
      expect(state.activeServerId).toBeNull();
    });
  });

  // ── hydrate ──

  describe('hydrate', () => {
    it('should populate servers from an array', () => {
      const servers: ServerRecord[] = [
        makeServer({ id: createServerId('s1'), name: 'Alpha' }),
        makeServer({ id: createServerId('s2'), name: 'Beta', status: 'stopped' }),
      ];
      store.getState().hydrate(servers);
      const state = store.getState();
      expect(state.servers).toHaveLength(2);
      expect(state.servers[0]!.name).toBe('Alpha');
      expect(state.servers[1]!.name).toBe('Beta');
    });

    it('should replace existing servers on re-hydrate', () => {
      store.getState().hydrate([
        makeServer({ id: createServerId('s1'), name: 'Alpha' }),
      ]);
      store.getState().hydrate([
        makeServer({ id: createServerId('s3'), name: 'Gamma' }),
      ]);
      const state = store.getState();
      expect(state.servers).toHaveLength(1);
      expect(state.servers[0]!.name).toBe('Gamma');
    });
  });

  // ── setActive ──

  describe('setActive', () => {
    it('should set activeServerId', () => {
      const id = createServerId('s1');
      store.getState().setActive(id);
      expect(store.getState().activeServerId).toBe(id);
    });

    it('should clear activeServerId with null', () => {
      store.getState().setActive(createServerId('s1'));
      store.getState().setActive(null);
      expect(store.getState().activeServerId).toBeNull();
    });
  });

  // ── updateOne ──

  describe('updateOne', () => {
    it('should update a single server by id', () => {
      const id = createServerId('s1');
      store.getState().hydrate([
        makeServer({ id, name: 'Alpha', status: 'running' }),
        makeServer({ id: createServerId('s2'), name: 'Beta' }),
      ]);

      store.getState().updateOne(id, { status: 'stopped' });

      const state = store.getState();
      expect(state.servers[0]!.status).toBe('stopped');
      expect(state.servers[1]!.status).toBe('running'); // unchanged
    });

    it('should update multiple fields at once', () => {
      const id = createServerId('s1');
      store.getState().hydrate([
        makeServer({ id, name: 'Alpha' }),
      ]);

      store.getState().updateOne(id, {
        status: 'failed',
        errorMessage: 'SSH timeout',
      });

      const server = store.getState().servers[0]!;
      expect(server.status).toBe('failed');
      expect(server.errorMessage).toBe('SSH timeout');
    });

    it('should be a no-op for non-existent id', () => {
      store.getState().hydrate([
        makeServer({ id: createServerId('s1'), name: 'Alpha' }),
      ]);

      store.getState().updateOne(createServerId('nonexistent'), { status: 'stopped' });

      expect(store.getState().servers).toHaveLength(1);
      expect(store.getState().servers[0]!.status).toBe('running');
    });
  });

  // ── addOne ──

  describe('addOne', () => {
    it('should add a server to the list', () => {
      const server = makeServer({ id: createServerId('s1'), name: 'Alpha' });
      store.getState().addOne(server);
      expect(store.getState().servers).toHaveLength(1);
      expect(store.getState().servers[0]!.name).toBe('Alpha');
    });

    it('should append to existing servers', () => {
      store.getState().hydrate([
        makeServer({ id: createServerId('s1'), name: 'Alpha' }),
      ]);
      store.getState().addOne(
        makeServer({ id: createServerId('s2'), name: 'Beta' }),
      );
      expect(store.getState().servers).toHaveLength(2);
      expect(store.getState().servers[1]!.name).toBe('Beta');
    });
  });

  // ── removeOne ──

  describe('removeOne', () => {
    it('should remove a server by id', () => {
      const id = createServerId('s1');
      store.getState().hydrate([
        makeServer({ id, name: 'Alpha' }),
        makeServer({ id: createServerId('s2'), name: 'Beta' }),
      ]);

      store.getState().removeOne(id);

      expect(store.getState().servers).toHaveLength(1);
      expect(store.getState().servers[0]!.name).toBe('Beta');
    });

    it('should clear activeServerId if removed server was active', () => {
      const id = createServerId('s1');
      store.getState().hydrate([makeServer({ id, name: 'Alpha' })]);
      store.getState().setActive(id);

      store.getState().removeOne(id);

      expect(store.getState().activeServerId).toBeNull();
    });

    it('should not clear activeServerId if different server removed', () => {
      const activeId = createServerId('s1');
      const otherId = createServerId('s2');
      store.getState().hydrate([
        makeServer({ id: activeId, name: 'Alpha' }),
        makeServer({ id: otherId, name: 'Beta' }),
      ]);
      store.getState().setActive(activeId);

      store.getState().removeOne(otherId);

      expect(store.getState().activeServerId).toBe(activeId);
    });
  });
});
