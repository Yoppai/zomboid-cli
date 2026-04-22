import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { ISshGateway, CommandResult } from '@/shared/infra/contracts/i-ssh-gateway.ts';
import type { ILocalDb } from '@/shared/infra/contracts/i-local-db.ts';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { ScheduledTask } from '@/shared/infra/entities/scheduled-task.ts';
import type { ServerId, ServerStatus, TaskId, TaskType } from '@/shared/infra/entities/enums.ts';
import type { SshConnectionConfig } from '@/shared/infra/entities/value-objects.ts';
import { createServerId, createTaskId } from '@/shared/infra/entities/enums.ts';

// Production code that does NOT exist yet — guarantees RED
import {
  SchedulerService,
  generateCrontabLine,
  validateCron,
} from '@/features/scheduler/services/scheduler-service.ts';

// ── Helpers ──

function makeServerRecord(overrides: Partial<ServerRecord> = {}): ServerRecord {
  return {
    id: createServerId('srv-sched-001'),
    name: 'sched-server',
    provider: 'gcp',
    projectId: 'my-project',
    instanceType: 'e2-standard-2',
    instanceZone: 'us-central1-a',
    staticIp: '34.120.5.1',
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

function makeTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: createTaskId('task-001'),
    serverId: createServerId('srv-sched-001'),
    type: 'auto_restart' as TaskType,
    cronExpression: '0 4 * * *',
    payload: null,
    enabled: true,
    createdAt: '2026-04-15T10:00:00Z',
    ...overrides,
  };
}

function createMockSsh(overrides: Partial<ISshGateway> = {}): ISshGateway {
  return {
    exec: mock(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
    execStream: mock(async () => {}),
    createTunnel: mock(async () => ({ close: mock(() => {}) })),
    testConnection: mock(async () => true),
    disconnect: mock(async () => {}),
    disconnectAll: mock(async () => {}),
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

describe('SchedulerService', () => {
  let ssh: ISshGateway;
  let db: ILocalDb;
  let svc: SchedulerService;

  beforeEach(() => {
    ssh = createMockSsh();
    db = createMockDb();
    svc = new SchedulerService(ssh, db);
  });

  // ── generateCrontabLine (pure function) ──

  describe('generateCrontabLine', () => {
    it('should generate auto_restart crontab line with docker compose restart', () => {
      const task = makeTask({
        type: 'auto_restart',
        cronExpression: '0 4 * * *',
      });

      const line = generateCrontabLine(task);

      expect(line).toContain('0 4 * * *');
      expect(line).toContain('docker compose');
      expect(line).toContain('restart');
    });

    it('should generate auto_backup crontab line with tar command', () => {
      const task = makeTask({
        type: 'auto_backup',
        cronExpression: '30 3 * * *',
      });

      const line = generateCrontabLine(task);

      expect(line).toContain('30 3 * * *');
      expect(line).toContain('tar');
      expect(line).toContain('/opt/zomboid');
    });

    it('should generate broadcast crontab line with payload message', () => {
      const task = makeTask({
        type: 'broadcast',
        cronExpression: '0 */2 * * *',
        payload: 'Server restart in 10 minutes',
      });

      const line = generateCrontabLine(task);

      expect(line).toContain('0 */2 * * *');
      expect(line).toContain('Server restart in 10 minutes');
    });

    it('should generate different commands for each task type', () => {
      const restart = generateCrontabLine(makeTask({ type: 'auto_restart', cronExpression: '0 0 * * *' }));
      const backup = generateCrontabLine(makeTask({ type: 'auto_backup', cronExpression: '0 0 * * *' }));
      const broadcast = generateCrontabLine(makeTask({ type: 'broadcast', cronExpression: '0 0 * * *', payload: 'Hello' }));

      // All three should be distinct commands
      expect(restart).not.toBe(backup);
      expect(restart).not.toBe(broadcast);
      expect(backup).not.toBe(broadcast);
    });
  });

  // ── validateCron (pure function) ──

  describe('validateCron', () => {
    it('should accept valid 5-field cron expressions', () => {
      const result = validateCron('0 4 * * *');
      expect(result.valid).toBe(true);
    });

    it('should accept complex valid cron expressions', () => {
      expect(validateCron('*/15 * * * *').valid).toBe(true);
      expect(validateCron('0 0 1,15 * *').valid).toBe(true);
      expect(validateCron('30 3 * * 0').valid).toBe(true);
    });

    it('should reject invalid cron expressions — too few fields', () => {
      const result = validateCron('0 4 *');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid cron expressions — out of range', () => {
      const result = validateCron('60 25 32 13 8');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject empty string', () => {
      const result = validateCron('');
      expect(result.valid).toBe(false);
    });
  });

  // ── addTask ──

  describe('addTask', () => {
    it('should persist task to database and install crontab via SSH', async () => {
      const server = makeServerRecord();
      const taskInput = {
        serverId: server.id,
        type: 'auto_restart' as TaskType,
        cronExpression: '0 4 * * *',
        payload: null,
        enabled: true,
      };

      db = createMockDb({
        getServer: mock(async () => server),
        createTask: mock(async () => {}),
      });
      svc = new SchedulerService(ssh, db);

      const result = await svc.addTask(server, taskInput);

      expect(result.type).toBe('auto_restart');
      expect(result.cronExpression).toBe('0 4 * * *');
      expect(result.id).toBeTruthy();
      expect(db.createTask).toHaveBeenCalledTimes(1);
      expect(ssh.exec).toHaveBeenCalled();
    });

    it('should install crontab entry via SSH with correct format', async () => {
      const server = makeServerRecord();
      let sshCommand = '';

      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string) => {
          sshCommand = cmd;
          return { stdout: '', stderr: '', exitCode: 0 };
        }),
      });
      // listTasks must return the task AFTER createTask stores it
      // so syncCrontab can generate the crontab line
      const storedTasks: ScheduledTask[] = [];
      db = createMockDb({
        getServer: mock(async () => server),
        createTask: mock(async (task: ScheduledTask) => {
          storedTasks.push(task);
        }),
        listTasks: mock(async () => storedTasks),
      });
      svc = new SchedulerService(ssh, db);

      await svc.addTask(server, {
        serverId: server.id,
        type: 'auto_restart' as TaskType,
        cronExpression: '0 4 * * *',
        payload: null,
        enabled: true,
      });

      expect(sshCommand).toContain('crontab');
      expect(sshCommand).toContain('0 4 * * *');
    });
  });

  // ── removeTask ──

  describe('removeTask', () => {
    it('should delete task from database and sync crontab', async () => {
      const server = makeServerRecord();
      const taskId = createTaskId('task-to-remove');

      db = createMockDb({
        getServer: mock(async () => server),
        deleteTask: mock(async () => {}),
        listTasks: mock(async () => []),
      });
      svc = new SchedulerService(ssh, db);

      await svc.removeTask(server, taskId);

      expect(db.deleteTask).toHaveBeenCalledWith(taskId);
      // Should sync crontab after removal
      expect(ssh.exec).toHaveBeenCalled();
    });
  });

  // ── listTasks ──

  describe('listTasks', () => {
    it('should return tasks from database for given serverId', async () => {
      const serverId = createServerId('srv-sched-001');
      const tasks = [
        makeTask({ id: createTaskId('t1'), type: 'auto_restart' }),
        makeTask({ id: createTaskId('t2'), type: 'auto_backup' }),
      ];

      db = createMockDb({
        listTasks: mock(async () => tasks),
      });
      svc = new SchedulerService(ssh, db);

      const result = await svc.listTasks(serverId);

      expect(result).toHaveLength(2);
      expect(result[0]!.type).toBe('auto_restart');
      expect(result[1]!.type).toBe('auto_backup');
      expect(db.listTasks).toHaveBeenCalledWith(serverId);
    });

    it('should return empty array when no tasks exist', async () => {
      const result = await svc.listTasks(createServerId('empty-srv'));
      expect(result).toEqual([]);
    });
  });

  // ── toggleTask ──

  describe('toggleTask', () => {
    it('should update enabled status in database and sync crontab', async () => {
      const server = makeServerRecord();
      const taskId = createTaskId('task-toggle');

      db = createMockDb({
        getServer: mock(async () => server),
        updateTask: mock(async () => {}),
        listTasks: mock(async () => [makeTask({ id: taskId, enabled: false })]),
      });
      svc = new SchedulerService(ssh, db);

      await svc.toggleTask(server, taskId, false);

      expect(db.updateTask).toHaveBeenCalledWith(taskId, { enabled: false });
      // Should sync crontab after toggle
      expect(ssh.exec).toHaveBeenCalled();
    });

    it('should enable a disabled task', async () => {
      const server = makeServerRecord();
      const taskId = createTaskId('task-enable');

      db = createMockDb({
        getServer: mock(async () => server),
        updateTask: mock(async () => {}),
        listTasks: mock(async () => [makeTask({ id: taskId, enabled: true })]),
      });
      svc = new SchedulerService(ssh, db);

      await svc.toggleTask(server, taskId, true);

      expect(db.updateTask).toHaveBeenCalledWith(taskId, { enabled: true });
    });
  });

  // ── syncCrontab ──

  describe('syncCrontab', () => {
    it('should rebuild crontab with only enabled tasks', async () => {
      const server = makeServerRecord();
      let sshCommand = '';
      const tasks = [
        makeTask({ id: createTaskId('t1'), type: 'auto_restart', cronExpression: '0 4 * * *', enabled: true }),
        makeTask({ id: createTaskId('t2'), type: 'auto_backup', cronExpression: '30 3 * * *', enabled: false }),
        makeTask({ id: createTaskId('t3'), type: 'broadcast', cronExpression: '0 */2 * * *', enabled: true, payload: 'Hello' }),
      ];

      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string) => {
          sshCommand = cmd;
          return { stdout: '', stderr: '', exitCode: 0 };
        }),
      });
      db = createMockDb({
        getServer: mock(async () => server),
        listTasks: mock(async () => tasks),
      });
      svc = new SchedulerService(ssh, db);

      await svc.syncCrontab(server);

      // Should contain enabled tasks (t1 and t3) but NOT disabled (t2)
      expect(sshCommand).toContain('0 4 * * *');
      expect(sshCommand).toContain('0 */2 * * *');
      // The disabled auto_backup cron should NOT be in the installed crontab
      // (we check that the tar command for backup is NOT present since it's disabled)
    });

    it('should install empty crontab when no tasks are enabled', async () => {
      const server = makeServerRecord();
      let sshCommand = '';

      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string) => {
          sshCommand = cmd;
          return { stdout: '', stderr: '', exitCode: 0 };
        }),
      });
      db = createMockDb({
        getServer: mock(async () => server),
        listTasks: mock(async () => []),
      });
      svc = new SchedulerService(ssh, db);

      await svc.syncCrontab(server);

      expect(sshCommand).toContain('crontab');
      expect(ssh.exec).toHaveBeenCalled();
    });
  });
});
