import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { ILocalDb } from '@/domain/repositories/i-local-db.ts';
import type { ServerRecord } from '@/domain/entities/server-record.ts';
import type { ServerId, ServerStatus } from '@/domain/entities/enums.ts';
import { createServerId } from '@/domain/entities/enums.ts';

// Production code that does NOT exist yet — guarantees RED
import {
  InventoryService,
  ServerNotFoundError,
  InvalidStatusTransitionError,
} from '@/application/services/inventory-service.ts';

// ── Helpers ──

function makeServerRecord(overrides: Partial<ServerRecord> = {}): ServerRecord {
  return {
    id: createServerId('test-uuid-1'),
    name: 'test-server',
    provider: 'gcp',
    projectId: 'my-project',
    instanceType: 'e2-standard-2',
    instanceZone: 'us-central1-a',
    staticIp: null,
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

// ── Tests ──

describe('InventoryService', () => {
  let db: ILocalDb;
  let svc: InventoryService;

  beforeEach(() => {
    db = createMockDb();
    svc = new InventoryService(db);
  });

  // ── createServer ──

  describe('createServer', () => {
    it('should generate a UUID ServerId and persist with status provisioning', async () => {
      const record = await svc.createServer({
        name: 'my-zomboid',
        provider: 'gcp',
        projectId: 'proj-1',
        zone: 'us-central1-a',
        instanceType: 'e2-standard-2',
        gameBranch: 'stable',
      });

      // Verify shape
      expect(record.id).toBeTruthy();
      expect(record.name).toBe('my-zomboid');
      expect(record.provider).toBe('gcp');
      expect(record.projectId).toBe('proj-1');
      expect(record.instanceZone).toBe('us-central1-a');
      expect(record.instanceType).toBe('e2-standard-2');
      expect(record.gameBranch).toBe('stable');
      expect(record.status).toBe('provisioning');
      expect(record.staticIp).toBeNull();
      expect(record.errorMessage).toBeNull();
      expect(record.backupPath).toBeNull();

      // UUID format check (v4-ish: 8-4-4-4-12 hex)
      expect(record.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );

      // SSH private key generated
      expect(record.sshPrivateKey.length).toBeGreaterThan(0);

      // RCON password generated (hex string, at least 16 chars)
      expect(record.rconPassword.length).toBeGreaterThanOrEqual(16);
      expect(record.rconPassword).toMatch(/^[0-9a-f]+$/);

      // Timestamps are ISO strings
      expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(record.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Persisted to DB
      expect(db.createServer).toHaveBeenCalledTimes(1);
    });

    it('should generate DIFFERENT UUIDs for consecutive calls', async () => {
      const input = {
        name: 'server-a',
        provider: 'gcp' as const,
        projectId: 'proj-1',
        zone: 'us-central1-a',
        instanceType: 'e2-standard-2',
        gameBranch: 'stable' as const,
      };

      const r1 = await svc.createServer(input);
      const r2 = await svc.createServer({ ...input, name: 'server-b' });

      expect(r1.id).not.toBe(r2.id);
      expect(r1.rconPassword).not.toBe(r2.rconPassword);
    });
  });

  // ── getServer ──

  describe('getServer', () => {
    it('should return server when found', async () => {
      const server = makeServerRecord({ name: 'found-server' });
      db = createMockDb({
        getServer: mock(async () => server),
      });
      svc = new InventoryService(db);

      const result = await svc.getServer(createServerId('test-uuid-1'));
      expect(result.name).toBe('found-server');
      expect(result.id).toBe(server.id);
    });

    it('should throw ServerNotFoundError when server does not exist', async () => {
      const id = createServerId('non-existent-id');
      await expect(svc.getServer(id)).rejects.toThrow(ServerNotFoundError);
    });

    it('ServerNotFoundError should contain the server id in message', async () => {
      const id = createServerId('missing-abc');
      try {
        await svc.getServer(id);
        expect(true).toBe(false); // Should not reach
      } catch (e) {
        expect(e).toBeInstanceOf(ServerNotFoundError);
        expect((e as ServerNotFoundError).message).toContain('missing-abc');
      }
    });
  });

  // ── listServers ──

  describe('listServers', () => {
    it('should delegate to localDb.listServers with no filter', async () => {
      const servers = [makeServerRecord({ name: 'a' }), makeServerRecord({ name: 'b' })];
      db = createMockDb({ listServers: mock(async () => servers) });
      svc = new InventoryService(db);

      const result = await svc.listServers();
      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe('a');
      expect(db.listServers).toHaveBeenCalledTimes(1);
    });

    it('should delegate to localDb.listServers with status filter', async () => {
      const running = [makeServerRecord({ status: 'running' })];
      db = createMockDb({ listServers: mock(async () => running) });
      svc = new InventoryService(db);

      const result = await svc.listServers({ status: 'running' });
      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe('running');
      expect(db.listServers).toHaveBeenCalledWith({ status: 'running' });
    });

    it('should return empty array when no servers exist', async () => {
      const result = await svc.listServers();
      expect(result).toEqual([]);
    });
  });

  describe('listActive / listArchived', () => {
    it('listActive should exclude archived records', async () => {
      const active = makeServerRecord({ id: createServerId('a-1'), status: 'running' });
      const stopped = makeServerRecord({ id: createServerId('a-2'), status: 'stopped' });
      db = createMockDb({ listServers: mock(async () => [active, stopped]) });
      svc = new InventoryService(db);

      const result = await svc.listActive();
      expect(result).toHaveLength(2);
      expect(db.listServers).toHaveBeenCalledWith();
    });

    it('listArchived should return only archived records', async () => {
      const archived = makeServerRecord({ id: createServerId('a-3'), status: 'archived' });
      db = createMockDb({ listServers: mock(async () => [archived]) });
      svc = new InventoryService(db);

      const result = await svc.listArchived();
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('archived');
      expect(db.listServers).toHaveBeenCalledWith({ status: 'archived' });
    });
  });

  // ── updateServerStatus ──

  describe('updateServerStatus', () => {
    it('should update status on valid transition (provisioning → running)', async () => {
      const server = makeServerRecord({ status: 'provisioning' });
      const updated = makeServerRecord({ status: 'running' });
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      // After update, getServer returns the updated record
      let callCount = 0;
      (db.getServer as any) = mock(async () => {
        callCount++;
        return callCount === 1 ? server : updated;
      });
      svc = new InventoryService(db);

      const result = await svc.updateServerStatus(server.id, 'running');
      expect(result.status).toBe('running');
      expect(db.updateServer).toHaveBeenCalledTimes(1);
    });

    it('should throw InvalidStatusTransitionError on invalid transition (archived → running)', async () => {
      const server = makeServerRecord({ status: 'archived' });
      db = createMockDb({
        getServer: mock(async () => server),
      });
      svc = new InventoryService(db);

      await expect(
        svc.updateServerStatus(server.id, 'running'),
      ).rejects.toThrow(InvalidStatusTransitionError);
      expect(db.updateServer).not.toHaveBeenCalled();
    });

    it('should throw ServerNotFoundError if server does not exist', async () => {
      await expect(
        svc.updateServerStatus(createServerId('nope'), 'running'),
      ).rejects.toThrow(ServerNotFoundError);
    });
  });

  // ── updateServerIp ──

  describe('updateServerIp', () => {
    it('should set static IP and return updated server', async () => {
      const server = makeServerRecord();
      const updated = makeServerRecord({ staticIp: '34.120.5.1' });
      let callCount = 0;
      db = createMockDb({
        getServer: mock(async () => {
          callCount++;
          return callCount === 1 ? server : updated;
        }),
        updateServer: mock(async () => {}),
      });
      svc = new InventoryService(db);

      const result = await svc.updateServerIp(server.id, '34.120.5.1');
      expect(result.staticIp).toBe('34.120.5.1');
      expect(db.updateServer).toHaveBeenCalledTimes(1);
    });

    it('should throw ServerNotFoundError if server does not exist', async () => {
      await expect(
        svc.updateServerIp(createServerId('nope'), '1.2.3.4'),
      ).rejects.toThrow(ServerNotFoundError);
    });
  });

  // ── archiveServer ──

  describe('archiveServer', () => {
    it('should set status to archived with backup path', async () => {
      const server = makeServerRecord({ status: 'stopped' });
      const archived = makeServerRecord({
        status: 'archived',
        backupPath: '/backups/server.tar.gz',
      });
      let callCount = 0;
      db = createMockDb({
        getServer: mock(async () => {
          callCount++;
          return callCount === 1 ? server : archived;
        }),
        updateServer: mock(async () => {}),
      });
      svc = new InventoryService(db);

      const result = await svc.archiveServer(
        server.id,
        '/backups/server.tar.gz',
      );
      expect(result.status).toBe('archived');
      expect(result.backupPath).toBe('/backups/server.tar.gz');
      expect(db.updateServer).toHaveBeenCalledTimes(1);
    });

    it('should reject archiving from invalid status (provisioning)', async () => {
      const server = makeServerRecord({ status: 'provisioning' });
      db = createMockDb({
        getServer: mock(async () => server),
      });
      svc = new InventoryService(db);

      await expect(
        svc.archiveServer(server.id, '/backups/x.tar.gz'),
      ).rejects.toThrow(InvalidStatusTransitionError);
    });
  });

  // ── deleteServer ──

  describe('deleteServer', () => {
    it('should delegate to localDb.deleteServer', async () => {
      const id = createServerId('del-me');
      await svc.deleteServer(id);
      expect(db.deleteServer).toHaveBeenCalledWith(id);
      expect(db.deleteServer).toHaveBeenCalledTimes(1);
    });
  });
});
