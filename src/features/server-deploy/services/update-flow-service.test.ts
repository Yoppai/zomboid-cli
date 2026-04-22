import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { ISshGateway, CommandResult } from '@/shared/infra/contracts/i-ssh-gateway.ts';
import type { ILocalDb } from '@/shared/infra/contracts/i-local-db.ts';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { ServerId, ServerStatus } from '@/shared/infra/entities/enums.ts';
import type { SshConnectionConfig, RconResponse } from '@/shared/infra/entities/value-objects.ts';
import { createServerId } from '@/shared/infra/entities/enums.ts';
import { RconService } from '@/features/server-dashboard/services/rcon-service';
import type { BackupService } from '@/features/backups/services/backup-service.ts';
import type { IRconGateway } from '@/shared/infra/contracts/i-rcon-gateway.ts';

// Production code that does NOT exist yet — guarantees RED
import { UpdateFlowService } from '@/features/server-deploy/services/update-flow-service.ts';

// ── Helpers ──

function makeServerRecord(overrides: Partial<ServerRecord> = {}): ServerRecord {
  return {
    id: createServerId('srv-update-001'),
    name: 'update-server',
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

function rconResponse(body: string): RconResponse {
  return { requestId: 1, body, type: 0 };
}

function createMockRcon(overrides: Partial<IRconGateway> = {}): IRconGateway {
  return {
    connect: mock(async () => {}),
    sendCommand: mock(async () => rconResponse('')),
    disconnect: mock(async () => {}),
    isConnected: mock(() => false),
    ...overrides,
  };
}

function createMockSsh(overrides: Partial<ISshGateway> = {}): ISshGateway {
  return {
    exec: mock(async () => ({
      stdout: 'zomboid-server   running',
      stderr: '',
      exitCode: 0,
    })),
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

function createMockBackup(overrides: Partial<BackupService> = {}): BackupService {
  return {
    create: mock(async () => ({
      serverId: createServerId('srv-update-001'),
      filename: 'zomboid-backup-2026-04-16.tar.gz',
      localPath: '/backups/update-server/zomboid-backup-2026-04-16.tar.gz',
      sizeBytes: 1024,
      createdAt: '2026-04-16T10:00:00Z',
    })),
    list: mock(async () => []),
    restore: mock(async () => {}),
    getBackupPath: mock(() => '/backups/update-server'),
    ...overrides,
  } as unknown as BackupService;
}

const noOpDelay = async (_ms: number) => {};

// ── Tests ──

describe('UpdateFlowService', () => {
  let rconGateway: IRconGateway;
  let rconService: RconService;
  let ssh: ISshGateway;
  let db: ILocalDb;
  let backup: BackupService;
  let svc: UpdateFlowService;

  beforeEach(() => {
    rconGateway = createMockRcon();
    ssh = createMockSsh();
    rconService = new RconService(rconGateway, ssh);
    db = createMockDb();
    backup = createMockBackup();
    svc = new UpdateFlowService(rconService, ssh, db, backup, { delayFn: noOpDelay });
  });

  // ── gracefulUpdate ──

  describe('gracefulUpdate', () => {
    it('should execute full flow in correct order: broadcast → delay → save → quit → pull+up → healthCheck', async () => {
      const callOrder: string[] = [];
      const server = makeServerRecord();

      rconGateway = createMockRcon({
        sendCommand: mock(async (cmd: string) => {
          if (cmd.includes('servermsg')) callOrder.push('broadcast');
          if (cmd === 'save') callOrder.push('save');
          if (cmd === 'quit') callOrder.push('quit');
          return rconResponse('');
        }),
      });
      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string) => {
          if (cmd.includes('pull')) callOrder.push('pull+up');
          if (cmd.includes('docker compose') && cmd.includes('ps')) callOrder.push('healthCheck');
          return { stdout: 'zomboid-server   running', stderr: '', exitCode: 0 };
        }),
        createTunnel: mock(async () => ({ close: mock(() => {}) })),
      });
      rconService = new RconService(rconGateway, ssh);
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });

      const delayCallArgs: number[] = [];
      svc = new UpdateFlowService(rconService, ssh, db, backup, {
        delayFn: async (ms: number) => { delayCallArgs.push(ms); },
      });

      // Connect RCON before updating
      await rconService.connect(
        { host: server.staticIp!, port: 22, username: 'root', privateKey: server.sshPrivateKey },
        server.rconPassword,
      );

      await svc.gracefulUpdate(server.id, 30);

      // Verify correct order
      expect(callOrder[0]).toBe('broadcast');
      expect(callOrder[1]).toBe('save');
      expect(callOrder[2]).toBe('quit');
      expect(callOrder).toContain('pull+up');

      // Verify delay was called with correct milliseconds
      expect(delayCallArgs[0]).toBe(30000);
    });

    it('should broadcast warning message with configurable seconds', async () => {
      const server = makeServerRecord();
      let broadcastMessage = '';

      rconGateway = createMockRcon({
        sendCommand: mock(async (cmd: string) => {
          if (cmd.includes('servermsg')) broadcastMessage = cmd;
          return rconResponse('');
        }),
      });
      ssh = createMockSsh({
        createTunnel: mock(async () => ({ close: mock(() => {}) })),
      });
      rconService = new RconService(rconGateway, ssh);
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      svc = new UpdateFlowService(rconService, ssh, db, backup, { delayFn: noOpDelay });

      await rconService.connect(
        { host: server.staticIp!, port: 22, username: 'root', privateKey: server.sshPrivateKey },
        server.rconPassword,
      );

      await svc.gracefulUpdate(server.id, 120);

      expect(broadcastMessage).toContain('120');
    });

    it('should default to 60 seconds warning when no warningSeconds provided', async () => {
      const server = makeServerRecord();

      const delayArgs: number[] = [];
      rconGateway = createMockRcon();
      ssh = createMockSsh({
        createTunnel: mock(async () => ({ close: mock(() => {}) })),
      });
      rconService = new RconService(rconGateway, ssh);
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      svc = new UpdateFlowService(rconService, ssh, db, backup, {
        delayFn: async (ms: number) => { delayArgs.push(ms); },
      });

      await rconService.connect(
        { host: server.staticIp!, port: 22, username: 'root', privateKey: server.sshPrivateKey },
        server.rconPassword,
      );

      await svc.gracefulUpdate(server.id);

      expect(delayArgs[0]).toBe(60000);
    });

    it('should execute docker compose pull then up via SSH', async () => {
      const server = makeServerRecord();
      const sshCommands: string[] = [];

      rconGateway = createMockRcon();
      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string) => {
          sshCommands.push(cmd);
          return { stdout: 'zomboid-server   running', stderr: '', exitCode: 0 };
        }),
        createTunnel: mock(async () => ({ close: mock(() => {}) })),
      });
      rconService = new RconService(rconGateway, ssh);
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      svc = new UpdateFlowService(rconService, ssh, db, backup, { delayFn: noOpDelay });

      await rconService.connect(
        { host: server.staticIp!, port: 22, username: 'root', privateKey: server.sshPrivateKey },
        server.rconPassword,
      );

      await svc.gracefulUpdate(server.id, 10);

      const pullCmd = sshCommands.find((c) => c.includes('pull'));
      const upCmd = sshCommands.find((c) => c.includes('up -d'));
      expect(pullCmd).toBeDefined();
      expect(pullCmd!).toContain('docker compose');
      expect(upCmd).toBeDefined();
    });

    it('should update server status to running after successful update', async () => {
      const server = makeServerRecord();
      const updateCalls: Array<{ fields: Record<string, unknown> }> = [];

      rconGateway = createMockRcon();
      ssh = createMockSsh({
        createTunnel: mock(async () => ({ close: mock(() => {}) })),
      });
      rconService = new RconService(rconGateway, ssh);
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async (_id: ServerId, fields: Record<string, unknown>) => {
          updateCalls.push({ fields });
        }),
      });
      svc = new UpdateFlowService(rconService, ssh, db, backup, { delayFn: noOpDelay });

      await rconService.connect(
        { host: server.staticIp!, port: 22, username: 'root', privateKey: server.sshPrivateKey },
        server.rconPassword,
      );

      await svc.gracefulUpdate(server.id, 5);

      const statusUpdate = updateCalls.find((c) => c.fields.status === 'running');
      expect(statusUpdate).toBeDefined();
    });

    it('should attempt rollback restart when pull fails and keep status running if rollback succeeds', async () => {
      const server = makeServerRecord();
      const sshCommands: string[] = [];

      const pullError = new Error('network timeout while pulling image');
      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string): Promise<CommandResult> => {
          sshCommands.push(cmd);

          if (cmd.includes('pull')) {
            throw pullError;
          }

          if (cmd.includes('up -d')) {
            return { stdout: 'rollback container restarted', stderr: '', exitCode: 0 };
          }

          return { stdout: 'zomboid-server   running', stderr: '', exitCode: 0 };
        }),
        createTunnel: mock(async () => ({ close: mock(() => {}) })),
      });

      rconGateway = createMockRcon();
      rconService = new RconService(rconGateway, ssh);

      const updateCalls: Array<Record<string, unknown>> = [];
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async (_id: ServerId, fields: Record<string, unknown>) => {
          updateCalls.push(fields);
        }),
      });

      svc = new UpdateFlowService(rconService, ssh, db, backup, { delayFn: noOpDelay });

      await rconService.connect(
        { host: server.staticIp!, port: 22, username: 'root', privateKey: server.sshPrivateKey },
        server.rconPassword,
      );

      await expect(svc.gracefulUpdate(server.id, 10)).rejects.toThrow(
        /docker compose pull failed.*network timeout while pulling image/i,
      );

      const rollbackCmd = sshCommands.find((cmd) => cmd.includes('up -d'));
      expect(rollbackCmd).toBeDefined();
      const failedStatusUpdate = updateCalls.find((fields) => fields.status === 'failed');
      expect(failedStatusUpdate).toBeUndefined();
    });

    it('should set status failed when pull fails and rollback restart also fails', async () => {
      const server = makeServerRecord();
      const pullError = new Error('image not found');
      const rollbackError = new Error('docker daemon unreachable');

      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string): Promise<CommandResult> => {
          if (cmd.includes('pull')) {
            throw pullError;
          }

          if (cmd.includes('up -d')) {
            throw rollbackError;
          }

          return { stdout: 'ok', stderr: '', exitCode: 0 };
        }),
        createTunnel: mock(async () => ({ close: mock(() => {}) })),
      });

      rconGateway = createMockRcon();
      rconService = new RconService(rconGateway, ssh);

      const updateCalls: Array<Record<string, unknown>> = [];
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async (_id: ServerId, fields: Record<string, unknown>) => {
          updateCalls.push(fields);
        }),
      });

      svc = new UpdateFlowService(rconService, ssh, db, backup, { delayFn: noOpDelay });

      await rconService.connect(
        { host: server.staticIp!, port: 22, username: 'root', privateKey: server.sshPrivateKey },
        server.rconPassword,
      );

      await expect(svc.gracefulUpdate(server.id, 10)).rejects.toThrow(
        /rollback restart failed.*docker daemon unreachable/i,
      );

      const failedStatusUpdate = updateCalls.find((fields) => fields.status === 'failed');
      expect(failedStatusUpdate).toBeDefined();
    });

    it('should halt update when pre-update backup fails and keep status running', async () => {
      const server = makeServerRecord();
      const backupError = new Error('backup disk full');
      backup = createMockBackup({
        create: mock(async () => {
          throw backupError;
        }),
      });

      const updateCalls: Array<Record<string, unknown>> = [];
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async (_id: ServerId, fields: Record<string, unknown>) => {
          updateCalls.push(fields);
        }),
      });

      svc = new UpdateFlowService(rconService, ssh, db, backup, { delayFn: noOpDelay });

      await expect(svc.gracefulUpdate(server.id, 10)).rejects.toThrow(
        /pre-update backup failed.*backup disk full/i,
      );

      expect(backup.create).toHaveBeenCalledTimes(1);
      expect(rconGateway.sendCommand).toHaveBeenCalledTimes(0);
      expect(ssh.exec).toHaveBeenCalledTimes(0);
      const failedStatusUpdate = updateCalls.find((fields) => fields.status === 'failed');
      expect(failedStatusUpdate).toBeUndefined();
    });
  });

  // ── quickRestart ──

  describe('quickRestart', () => {
    it('should skip broadcast and delay, go straight to save → quit → restart', async () => {
      const callOrder: string[] = [];
      const server = makeServerRecord();

      rconGateway = createMockRcon({
        sendCommand: mock(async (cmd: string) => {
          if (cmd.includes('servermsg')) callOrder.push('broadcast');
          if (cmd === 'save') callOrder.push('save');
          if (cmd === 'quit') callOrder.push('quit');
          return rconResponse('');
        }),
      });
      ssh = createMockSsh({
        exec: mock(async (_conn: SshConnectionConfig, cmd: string) => {
          if (cmd.includes('up -d')) callOrder.push('restart');
          return { stdout: 'zomboid-server   running', stderr: '', exitCode: 0 };
        }),
        createTunnel: mock(async () => ({ close: mock(() => {}) })),
      });
      rconService = new RconService(rconGateway, ssh);
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      svc = new UpdateFlowService(rconService, ssh, db, backup, { delayFn: noOpDelay });

      await rconService.connect(
        { host: server.staticIp!, port: 22, username: 'root', privateKey: server.sshPrivateKey },
        server.rconPassword,
      );

      await svc.quickRestart(server.id);

      // No broadcast should appear
      expect(callOrder).not.toContain('broadcast');
      // Save, quit, restart should happen
      expect(callOrder).toContain('save');
      expect(callOrder).toContain('quit');
      expect(callOrder).toContain('restart');
    });

    it('should update status to running after successful quick restart', async () => {
      const server = makeServerRecord();
      const updateCalls: Array<{ fields: Record<string, unknown> }> = [];

      rconGateway = createMockRcon();
      ssh = createMockSsh({
        createTunnel: mock(async () => ({ close: mock(() => {}) })),
      });
      rconService = new RconService(rconGateway, ssh);
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async (_id: ServerId, fields: Record<string, unknown>) => {
          updateCalls.push({ fields });
        }),
      });
      svc = new UpdateFlowService(rconService, ssh, db, backup, { delayFn: noOpDelay });

      await rconService.connect(
        { host: server.staticIp!, port: 22, username: 'root', privateKey: server.sshPrivateKey },
        server.rconPassword,
      );

      await svc.quickRestart(server.id);

      const statusUpdate = updateCalls.find((c) => c.fields.status === 'running');
      expect(statusUpdate).toBeDefined();
    });
  });
});
