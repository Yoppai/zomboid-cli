import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { ICloudProvider, DestroyResult } from '@/shared/infra/contracts/i-cloud-provider.ts';
import type { ILocalDb } from '@/shared/infra/contracts/i-local-db.ts';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { ServerId, ServerStatus } from '@/shared/infra/entities/enums.ts';
import type { BackupMeta } from '@/shared/infra/entities/value-objects.ts';
import { createServerId } from '@/shared/infra/entities/enums.ts';
import { CdktfDestroyError } from '@/shared/infra/entities/errors.ts';
import { BackupService } from '@/features/backups/services/backup-service.ts';

// Production code that does NOT exist yet — guarantees RED
import { ArchiveService } from '@/features/archive/services/archive-service.ts';

// ── Helpers ──

function makeServerRecord(overrides: Partial<ServerRecord> = {}): ServerRecord {
  return {
    id: createServerId('srv-archive-001'),
    name: 'archive-server',
    provider: 'gcp',
    projectId: 'my-project',
    instanceType: 'e2-standard-2',
    instanceZone: 'us-central1-a',
    staticIp: '34.120.5.1',
    sshPrivateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
    rconPassword: 'abc123def456',
    gameBranch: 'stable',
    status: 'stopped' as ServerStatus,
    errorMessage: null,
    backupPath: null,
    createdAt: '2026-04-15T10:00:00Z',
    updatedAt: '2026-04-15T10:00:00Z',
    ...overrides,
  };
}

function makeBackupMeta(overrides: Partial<BackupMeta> = {}): BackupMeta {
  return {
    serverId: createServerId('srv-archive-001'),
    filename: 'zomboid-backup-2026-04-15.tar.gz',
    localPath: '/backups/archive-server/zomboid-backup-2026-04-15.tar.gz',
    sizeBytes: 1024000,
    createdAt: '2026-04-15T10:00:00Z',
    ...overrides,
  };
}

function createMockBackup(overrides: Partial<BackupService> = {}): BackupService {
  return {
    create: mock(async () => makeBackupMeta()),
    list: mock(async () => []),
    restore: mock(async () => {}),
    getBackupPath: mock(() => '/backups/archive-server'),
    ...overrides,
  } as unknown as BackupService;
}

function createMockCloud(overrides: Partial<ICloudProvider> = {}): ICloudProvider {
  return {
    verifyAuth: mock(async () => true),
    listProjects: mock(async () => []),
    enableApis: mock(async () => {}),
    ensureStateBucket: mock(async () => 'bucket'),
    listZones: mock(async () => []),
    listMachineTypes: mock(async () => []),
    provision: mock(async () => ({
      staticIp: '34.120.5.1',
      instanceZone: 'us-central1-a',
      success: true,
    })),
    destroy: mock(async () => ({ success: true })),
    getInstanceStatus: mock(async () => 'RUNNING' as const),
    stopInstance: mock(async () => {}),
    startInstance: mock(async () => {}),
    changeMachineType: mock(async () => {}),
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

describe('ArchiveService', () => {
  let backup: BackupService;
  let cloud: ICloudProvider;
  let db: ILocalDb;
  let svc: ArchiveService;

  beforeEach(() => {
    backup = createMockBackup();
    cloud = createMockCloud();
    db = createMockDb();
    svc = new ArchiveService(backup, cloud, db);
  });

  // ── archive ──

  describe('archive', () => {
    it('should execute full flow in correct order: backup → destroy → updateStatus → disableTasks', async () => {
      const callOrder: string[] = [];
      const server = makeServerRecord();

      backup = createMockBackup({
        create: mock(async () => {
          callOrder.push('backup');
          return makeBackupMeta();
        }),
      } as Partial<BackupService>);
      cloud = createMockCloud({
        destroy: mock(async () => {
          callOrder.push('destroy');
          return { success: true };
        }),
      });
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {
          callOrder.push('updateServer');
        }),
        listTasks: mock(async () => [{
          id: createServerId('task-1') as any,
          serverId: server.id,
          type: 'auto_backup' as const,
          cronExpression: '0 4 * * *',
          payload: null,
          enabled: true,
          createdAt: new Date().toISOString(),
        }]),
        updateTask: mock(async () => {
          callOrder.push('disableTasks');
        }),
      });

      svc = new ArchiveService(backup, cloud, db);

      await svc.archive(server.id);

      expect(callOrder[0]).toBe('backup');
      expect(callOrder[1]).toBe('destroy');
      expect(callOrder[2]).toBe('updateServer');
      expect(callOrder[3]).toBe('disableTasks');
    });

    it('should call backup.create BEFORE cloud.destroy (mandatory backup)', async () => {
      const server = makeServerRecord();
      let backupCalled = false;
      let destroyCalledWithBackup = false;

      backup = createMockBackup({
        create: mock(async () => {
          backupCalled = true;
          return makeBackupMeta();
        }),
      } as Partial<BackupService>);
      cloud = createMockCloud({
        destroy: mock(async () => {
          destroyCalledWithBackup = backupCalled;
          return { success: true };
        }),
      });
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
        deleteTasksByServer: mock(async () => {}),
      });

      svc = new ArchiveService(backup, cloud, db);

      await svc.archive(server.id);

      expect(backupCalled).toBe(true);
      expect(destroyCalledWithBackup).toBe(true);
    });

    it('should ABORT entire flow when backup fails — NO destroy called', async () => {
      const server = makeServerRecord();

      backup = createMockBackup({
        create: mock(async () => {
          throw new Error('Backup compression failed');
        }),
      } as Partial<BackupService>);
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });

      svc = new ArchiveService(backup, cloud, db);

      await expect(svc.archive(server.id)).rejects.toThrow('Backup compression failed');

      // CRITICAL: destroy must NOT have been called
      expect(cloud.destroy).not.toHaveBeenCalled();
      // Status should NOT be set to 'archived'
      expect(db.updateServer).not.toHaveBeenCalled();
    });

    it('should set status to failed when destroy fails after successful backup', async () => {
      const server = makeServerRecord();
      const updateCalls: Array<{ fields: Record<string, unknown> }> = [];

      backup = createMockBackup();
      cloud = createMockCloud({
        destroy: mock(async () => ({ success: false, error: 'Destroy timeout' })),
      });
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async (_id: ServerId, fields: Record<string, unknown>) => {
          updateCalls.push({ fields });
        }),
        deleteTasksByServer: mock(async () => {}),
      });

      svc = new ArchiveService(backup, cloud, db);

      await expect(svc.archive(server.id)).rejects.toThrow(CdktfDestroyError);

      // Backup was called (it should have run)
      expect(backup.create).toHaveBeenCalledTimes(1);
      // Status should be 'failed', NOT 'archived'
      const failUpdate = updateCalls.find((c) => c.fields.status === 'failed');
      expect(failUpdate).toBeDefined();
    });

    it('should set status to archived with backup path on success', async () => {
      const server = makeServerRecord();
      const updateCalls: Array<{ fields: Record<string, unknown> }> = [];

      backup = createMockBackup({
        create: mock(async () =>
          makeBackupMeta({ localPath: '/backups/archive-server/final-backup.tar.gz' }),
        ),
      } as Partial<BackupService>);
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async (_id: ServerId, fields: Record<string, unknown>) => {
          updateCalls.push({ fields });
        }),
        deleteTasksByServer: mock(async () => {}),
      });

      svc = new ArchiveService(backup, cloud, db);

      await svc.archive(server.id);

      const archiveUpdate = updateCalls.find((c) => c.fields.status === 'archived');
      expect(archiveUpdate).toBeDefined();
      expect(archiveUpdate!.fields.backupPath).toBe(
        '/backups/archive-server/final-backup.tar.gz',
      );
    });

    it('should disable all scheduled tasks after successful archive', async () => {
      const server = makeServerRecord();
      const taskId = createServerId('task-disable-1') as any;

      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
        listTasks: mock(async () => [{
          id: taskId,
          serverId: server.id,
          type: 'auto_restart' as const,
          cronExpression: '0 3 * * *',
          payload: null,
          enabled: true,
          createdAt: new Date().toISOString(),
        }]),
        updateTask: mock(async () => {}),
      });

      svc = new ArchiveService(backup, cloud, db);

      await svc.archive(server.id);

      expect(db.updateTask).toHaveBeenCalledWith(taskId, { enabled: false });
      expect(db.deleteTasksByServer).not.toHaveBeenCalled();
    });

    it('should return backup path for user confirmation', async () => {
      const server = makeServerRecord();

      backup = createMockBackup({
        create: mock(async () =>
          makeBackupMeta({ localPath: '/home/user/backups/server.tar.gz' }),
        ),
      } as Partial<BackupService>);
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
        deleteTasksByServer: mock(async () => {}),
      });

      svc = new ArchiveService(backup, cloud, db);

      const result = await svc.archive(server.id);

      expect(result.backupPath).toBe('/home/user/backups/server.tar.gz');
    });
  });
});
