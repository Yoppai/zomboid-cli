import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { SqliteLocalDb } from '@/shared/infra/database/sqlite-local-db.ts';
import { createServerId, createTaskId } from '@/shared/infra/entities/enums.ts';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { ScheduledTask } from '@/shared/infra/entities/scheduled-task.ts';
import type { ServerStatus } from '@/shared/infra/entities/enums.ts';

// ── Helper: build a valid ServerRecord ──
function makeServer(overrides: Partial<ServerRecord> = {}): ServerRecord {
  return {
    id: createServerId(crypto.randomUUID()),
    name: `server-${Date.now()}`,
    provider: 'gcp',
    projectId: 'my-project',
    instanceType: 'e2-standard-2',
    instanceZone: 'us-central1-a',
    staticIp: null,
    sshPrivateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
    rconPassword: 'rcon-secret-123',
    gameBranch: 'stable',
    status: 'provisioning',
    errorMessage: null,
    backupPath: null,
    createdAt: '2026-04-15T10:00:00Z',
    updatedAt: '2026-04-15T10:00:00Z',
    ...overrides,
  };
}

function makeTask(serverId: string, overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: createTaskId(crypto.randomUUID()),
    serverId: createServerId(serverId),
    type: 'auto_restart',
    cronExpression: '0 4 * * *',
    payload: null,
    enabled: true,
    createdAt: '2026-04-15T10:00:00Z',
    ...overrides,
  };
}

describe('SqliteLocalDb', () => {
  let localDb: SqliteLocalDb;

  beforeEach(() => {
    localDb = new SqliteLocalDb(':memory:');
  });

  afterEach(() => {
    localDb.close();
  });

  // ── Server CRUD ──

  describe('createServer + getServer', () => {
    it('should insert and retrieve a server record', async () => {
      const server = makeServer({ name: 'alpha-server' });
      await localDb.createServer(server);

      const found = await localDb.getServer(server.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('alpha-server');
      expect(found!.provider).toBe('gcp');
      expect(found!.status).toBe('provisioning');
      expect(found!.projectId).toBe('my-project');
      expect(found!.instanceType).toBe('e2-standard-2');
      expect(found!.sshPrivateKey).toBe('-----BEGIN OPENSSH PRIVATE KEY-----');
      expect(found!.rconPassword).toBe('rcon-secret-123');
      expect(found!.gameBranch).toBe('stable');
    });

    it('should return null for non-existent server', async () => {
      const found = await localDb.getServer(createServerId('nonexistent'));
      expect(found).toBeNull();
    });

    it('should reject duplicate server names', async () => {
      const s1 = makeServer({ name: 'unique-name' });
      await localDb.createServer(s1);

      const s2 = makeServer({ name: 'unique-name' });
      await expect(localDb.createServer(s2)).rejects.toThrow();
    });
  });

  describe('listServers', () => {
    it('should return all servers when no filter', async () => {
      await localDb.createServer(makeServer({ name: 'srv-1', status: 'running' }));
      await localDb.createServer(makeServer({ name: 'srv-2', status: 'stopped' }));
      await localDb.createServer(makeServer({ name: 'srv-3', status: 'archived' }));

      const all = await localDb.listServers();
      expect(all).toHaveLength(3);
    });

    it('should filter by status', async () => {
      await localDb.createServer(makeServer({ name: 'r1', status: 'running' }));
      await localDb.createServer(makeServer({ name: 'r2', status: 'running' }));
      await localDb.createServer(makeServer({ name: 's1', status: 'stopped' }));
      await localDb.createServer(makeServer({ name: 'a1', status: 'archived' }));

      const running = await localDb.listServers({ status: 'running' });
      expect(running).toHaveLength(2);
      expect(running.every((s) => s.status === 'running')).toBe(true);

      const archived = await localDb.listServers({ status: 'archived' });
      expect(archived).toHaveLength(1);
      expect(archived[0]!.status).toBe('archived');
    });

    it('should return empty array when no servers match filter', async () => {
      await localDb.createServer(makeServer({ name: 'x', status: 'running' }));
      const result = await localDb.listServers({ status: 'failed' });
      expect(result).toHaveLength(0);
    });
  });

  describe('updateServer', () => {
    it('should update status with valid transition', async () => {
      const server = makeServer({ name: 'upd-1', status: 'provisioning' });
      await localDb.createServer(server);

      await localDb.updateServer(server.id, {
        status: 'running',
        updatedAt: '2026-04-15T12:00:00Z',
      });

      const updated = await localDb.getServer(server.id);
      expect(updated!.status).toBe('running');
      expect(updated!.updatedAt).toBe('2026-04-15T12:00:00Z');
    });

    it('should reject invalid status transition', async () => {
      const server = makeServer({ name: 'upd-2', status: 'archived' });
      await localDb.createServer(server);

      await expect(
        localDb.updateServer(server.id, { status: 'running' }),
      ).rejects.toThrow(/Cannot transition/);
    });

    it('should update non-status fields without transition check', async () => {
      const server = makeServer({ name: 'upd-3', status: 'running' });
      await localDb.createServer(server);

      await localDb.updateServer(server.id, {
        errorMessage: 'something went wrong',
        staticIp: '1.2.3.4',
      });

      const updated = await localDb.getServer(server.id);
      expect(updated!.errorMessage).toBe('something went wrong');
      expect(updated!.staticIp).toBe('1.2.3.4');
      expect(updated!.status).toBe('running'); // unchanged
    });

    it('should update backupPath and gameBranch', async () => {
      const server = makeServer({ name: 'upd-4', status: 'running' });
      await localDb.createServer(server);

      await localDb.updateServer(server.id, {
        backupPath: '/backups/srv.tar.gz',
        gameBranch: 'unstable',
      });

      const updated = await localDb.getServer(server.id);
      expect(updated!.backupPath).toBe('/backups/srv.tar.gz');
      expect(updated!.gameBranch).toBe('unstable');
    });
  });

  describe('deleteServer', () => {
    it('should delete a server record', async () => {
      const server = makeServer({ name: 'del-1' });
      await localDb.createServer(server);

      await localDb.deleteServer(server.id);
      const found = await localDb.getServer(server.id);
      expect(found).toBeNull();
    });

    it('should not throw when deleting non-existent server', async () => {
      await expect(
        localDb.deleteServer(createServerId('nonexistent')),
      ).resolves.toBeUndefined();
    });
  });

  // ── Scheduled Tasks CRUD ──

  describe('createTask + getTask', () => {
    it('should insert and retrieve a scheduled task', async () => {
      const server = makeServer({ name: 'task-srv' });
      await localDb.createServer(server);

      const task = makeTask(String(server.id), {
        type: 'auto_backup',
        cronExpression: '0 3 * * *',
        payload: null,
      });
      await localDb.createTask(task);

      const found = await localDb.getTask(task.id);
      expect(found).not.toBeNull();
      expect(found!.type).toBe('auto_backup');
      expect(found!.cronExpression).toBe('0 3 * * *');
      expect(found!.enabled).toBe(true);
    });

    it('should return null for non-existent task', async () => {
      const found = await localDb.getTask(createTaskId('nonexistent'));
      expect(found).toBeNull();
    });
  });

  describe('listTasks', () => {
    it('should list tasks for a specific server', async () => {
      const s1 = makeServer({ name: 'lt-srv-1' });
      const s2 = makeServer({ name: 'lt-srv-2' });
      await localDb.createServer(s1);
      await localDb.createServer(s2);

      await localDb.createTask(makeTask(String(s1.id), { type: 'auto_restart' }));
      await localDb.createTask(makeTask(String(s1.id), { type: 'auto_backup' }));
      await localDb.createTask(makeTask(String(s2.id), { type: 'broadcast', payload: 'hello' }));

      const s1Tasks = await localDb.listTasks(s1.id);
      expect(s1Tasks).toHaveLength(2);

      const s2Tasks = await localDb.listTasks(s2.id);
      expect(s2Tasks).toHaveLength(1);
      expect(s2Tasks[0]!.type).toBe('broadcast');
    });

    it('should return empty array for server with no tasks', async () => {
      const server = makeServer({ name: 'no-tasks' });
      await localDb.createServer(server);

      const tasks = await localDb.listTasks(server.id);
      expect(tasks).toHaveLength(0);
    });
  });

  describe('updateTask', () => {
    it('should update task fields', async () => {
      const server = makeServer({ name: 'ut-srv' });
      await localDb.createServer(server);

      const task = makeTask(String(server.id));
      await localDb.createTask(task);

      await localDb.updateTask(task.id, {
        cronExpression: '*/5 * * * *',
        enabled: false,
      });

      const updated = await localDb.getTask(task.id);
      expect(updated!.cronExpression).toBe('*/5 * * * *');
      expect(updated!.enabled).toBe(false);
    });

    it('should update payload', async () => {
      const server = makeServer({ name: 'ut-payload-srv' });
      await localDb.createServer(server);

      const task = makeTask(String(server.id), { type: 'broadcast', payload: 'old msg' });
      await localDb.createTask(task);

      await localDb.updateTask(task.id, { payload: 'new msg' });
      const updated = await localDb.getTask(task.id);
      expect(updated!.payload).toBe('new msg');
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      const server = makeServer({ name: 'dt-srv' });
      await localDb.createServer(server);

      const task = makeTask(String(server.id));
      await localDb.createTask(task);

      await localDb.deleteTask(task.id);
      const found = await localDb.getTask(task.id);
      expect(found).toBeNull();
    });
  });

  describe('deleteTasksByServer', () => {
    it('should delete all tasks for a server', async () => {
      const server = makeServer({ name: 'dts-srv' });
      await localDb.createServer(server);

      await localDb.createTask(makeTask(String(server.id)));
      await localDb.createTask(makeTask(String(server.id)));

      await localDb.deleteTasksByServer(server.id);
      const tasks = await localDb.listTasks(server.id);
      expect(tasks).toHaveLength(0);
    });

    it('should not affect tasks for other servers', async () => {
      const s1 = makeServer({ name: 'dts-s1' });
      const s2 = makeServer({ name: 'dts-s2' });
      await localDb.createServer(s1);
      await localDb.createServer(s2);

      await localDb.createTask(makeTask(String(s1.id)));
      await localDb.createTask(makeTask(String(s2.id)));

      await localDb.deleteTasksByServer(s1.id);

      expect(await localDb.listTasks(s1.id)).toHaveLength(0);
      expect(await localDb.listTasks(s2.id)).toHaveLength(1);
    });
  });

  // ── Settings ──

  describe('getSetting + setSetting', () => {
    it('should return null for non-existent setting', async () => {
      const val = await localDb.getSetting('theme');
      expect(val).toBeNull();
    });

    it('should seed default settings on initialization', async () => {
      const locale = await localDb.getSetting('locale');
      expect(locale).toBe('en');

      const backupPath = await localDb.getSetting('backup_path');
      expect(backupPath).toBe('~/.zomboid-cli/backups');
    });

    it('should set and get a setting value', async () => {
      await localDb.setSetting('theme', 'dark');
      const val = await localDb.getSetting('theme');
      expect(val).toBe('dark');
    });

    it('should upsert — overwrite existing setting', async () => {
      await localDb.setSetting('locale', 'es');
      const val = await localDb.getSetting('locale');
      expect(val).toBe('es');
    });
  });

  // ── Lifecycle ──

  describe('close', () => {
    it('should close the database handle without error', () => {
      expect(() => localDb.close()).not.toThrow();
    });
  });
});

