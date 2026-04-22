/**
 * Phase 2 Task 2.1 — tests/helpers/mock-services.ts
 *
 * Provides a fully-typed vi.fn() mock factory for all application services
 * and infrastructure repositories.
 *
 * Tests import this to get deterministic, no-network mocks without needing
 * real SqliteLocalDb, SSH pools, or cloud credentials.
 */
import { vi } from 'bun:test';
import type { ILocalDb, ISshGateway, ISftpGateway, IRconGateway, ICloudProvider, IFilePickerGateway } from '@/shared/infra/contracts/index.ts';
import type { InventoryService } from '@/features/server-dashboard/services/inventory-service';
import type { LatencyService } from '@/features/server-dashboard/services/latency-service';
import type { RconService } from '@/features/server-dashboard/services/rcon-service';
import type { StatsService } from '@/features/server-dashboard/services/stats-service';
import type { DeployService } from '@/features/server-deploy/services/deploy-service.ts';
import type { BackupService } from '@/features/backups/services/backup-service.ts';
import type { UpdateFlowService } from '@/features/server-deploy/services/update-flow-service.ts';
import type { SchedulerService } from '@/features/scheduler/services/scheduler-service.ts';
import type { ArchiveService } from '@/features/archive/services/archive-service.ts';
import type { NotificationStore } from '@/shared/infra/notification-store.ts';
import type { ContainerStats } from '@/shared/infra/entities/value-objects.ts';

export interface MockServices {
  services: {
    inventory: Partial<InventoryService> & {
      listServers: ReturnType<typeof vi.fn>;
      listActive: ReturnType<typeof vi.fn>;
      listArchived: ReturnType<typeof vi.fn>;
      getServer: ReturnType<typeof vi.fn>;
      createServer: ReturnType<typeof vi.fn>;
      updateServerStatus: ReturnType<typeof vi.fn>;
      deleteServer: ReturnType<typeof vi.fn>;
      updateServerIp: ReturnType<typeof vi.fn>;
      archiveServer: ReturnType<typeof vi.fn>;
    };
    latency: Partial<LatencyService> & Record<string, ReturnType<typeof vi.fn>>;
    rcon: Partial<RconService> & Record<string, ReturnType<typeof vi.fn>>;
    stats: Partial<StatsService> & {
      getStats: ReturnType<typeof vi.fn>;
      getContainerStats: ReturnType<typeof vi.fn>;
      getLogSnapshot: ReturnType<typeof vi.fn>;
      getRecentLogs: ReturnType<typeof vi.fn>;
      streamLogs: ReturnType<typeof vi.fn>;
    };
    deploy: Partial<DeployService> & {
      deploy: ReturnType<typeof vi.fn>;
      startServer: ReturnType<typeof vi.fn>;
      stopServer: ReturnType<typeof vi.fn>;
      changeInstanceType: ReturnType<typeof vi.fn>;
    };
    backup: Partial<BackupService> & Record<string, ReturnType<typeof vi.fn>>;
    updateFlow: Partial<UpdateFlowService> & Record<string, ReturnType<typeof vi.fn>>;
    scheduler: Partial<SchedulerService> & Record<string, ReturnType<typeof vi.fn>>;
    archive: Partial<ArchiveService> & Record<string, ReturnType<typeof vi.fn>>;
    notificationStore: NotificationStore;
  };
  repositories: {
    localDb: Partial<ILocalDb> & Record<string, ReturnType<typeof vi.fn>>;
    sshGateway: Partial<ISshGateway> & Record<string, ReturnType<typeof vi.fn>>;
    sftpGateway: Partial<ISftpGateway> & Record<string, ReturnType<typeof vi.fn>>;
    rconGateway: Partial<IRconGateway> & Record<string, ReturnType<typeof vi.fn>>;
    cloudProvider: Partial<ICloudProvider> & Record<string, ReturnType<typeof vi.fn>>;
    filePicker: Partial<IFilePickerGateway> & Record<string, ReturnType<typeof vi.fn>>;
    pinger: Record<string, ReturnType<typeof vi.fn>>;
  };
}

export interface CreateMockServicesOptions {
  inventory?: Partial<MockServices['services']['inventory']>;
  latency?: Partial<MockServices['services']['latency']>;
  rcon?: Partial<MockServices['services']['rcon']>;
  stats?: Partial<MockServices['services']['stats']>;
  deploy?: Partial<MockServices['services']['deploy']>;
  backup?: Partial<MockServices['services']['backup']>;
  updateFlow?: Partial<MockServices['services']['updateFlow']>;
  scheduler?: Partial<MockServices['services']['scheduler']>;
  archive?: Partial<MockServices['services']['archive']>;
  repositories?: Partial<MockServices['repositories']>;
}

/**
 * createMockServices — factory returning fully-mocked service + repository bags.
 *
 * Each mock method is a vi.fn() that returns safe defaults (empty arrays, null,
 * resolved promises) so tests don't need to set up every call individually.
 *
 * @param overrides — partial overrides for specific methods (e.g. to make
 *   inventory.listActive return pre-seeded server records)
 */
export function createMockServices(options: CreateMockServicesOptions = {}): MockServices {
  // ── Repositories ──────────────────────────────────────────────────────────────

  const localDb = {
    createServer: vi.fn().mockResolvedValue(undefined),
    getServer: vi.fn().mockResolvedValue(null),
    listServers: vi.fn().mockResolvedValue([]),
    updateServer: vi.fn().mockResolvedValue(undefined),
    deleteServer: vi.fn().mockResolvedValue(undefined),
    createTask: vi.fn().mockResolvedValue(undefined),
    getTask: vi.fn().mockResolvedValue(null),
    listTasks: vi.fn().mockResolvedValue([]),
    updateTask: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    deleteTasksByServer: vi.fn().mockResolvedValue(undefined),
    getSetting: vi.fn().mockResolvedValue(null),
    setSetting: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    ...options.repositories?.localDb,
  };

  const sshGateway = {
    exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    execStream: vi.fn().mockResolvedValue(undefined),
    createTunnel: vi.fn().mockResolvedValue({ close: vi.fn() }),
    testConnection: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    disconnectAll: vi.fn().mockResolvedValue(undefined),
    ...options.repositories?.sshGateway,
  };

  const sftpGateway = {
    upload: vi.fn().mockResolvedValue(undefined),
    download: vi.fn().mockResolvedValue(undefined),
    listRemote: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(false),
    ...options.repositories?.sftpGateway,
  };

  const rconGateway = {
    connect: vi.fn().mockResolvedValue(undefined),
    sendCommand: vi.fn().mockResolvedValue({ requestId: 0, body: '', type: 0 }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(false),
    ...options.repositories?.rconGateway,
  };

  const cloudProvider = {
    verifyAuth: vi.fn().mockResolvedValue(true),
    listProjects: vi.fn().mockResolvedValue([]),
    enableApis: vi.fn().mockResolvedValue(undefined),
    ensureStateBucket: vi.fn().mockResolvedValue('tf-state-bucket'),
    listZones: vi.fn().mockResolvedValue([]),
    listMachineTypes: vi.fn().mockResolvedValue([]),
    provision: vi.fn().mockResolvedValue({ staticIp: '', instanceZone: '', success: true }),
    destroy: vi.fn().mockResolvedValue({ success: true }),
    getInstanceStatus: vi.fn().mockResolvedValue('STOPPED'),
    stopInstance: vi.fn().mockResolvedValue(undefined),
    startInstance: vi.fn().mockResolvedValue(undefined),
    changeMachineType: vi.fn().mockResolvedValue(undefined),
    // spawnFn is CdktfCloudProvider's internal dependency (not ICloudProvider interface)
    // Added here so tests using CdktfCloudProvider directly can mock spawn behavior
    spawnFn: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    ...options.repositories?.cloudProvider,
  };

  const filePicker = {
    pickFile: vi.fn().mockResolvedValue(null),
    pickDirectory: vi.fn().mockResolvedValue(null),
    detectPlatform: vi.fn().mockReturnValue('unsupported'),
    ...options.repositories?.filePicker,
  };

  const pinger = {
    ping: vi.fn().mockResolvedValue({ latencyMs: 0, available: true }),
    ...options.repositories?.pinger,
  };

  // ── Services ──────────────────────────────────────────────────────────────────

  // notificationStore is a zustand vanilla store — provide getState so code that
  // calls store.getState() (e.g. notificationStore.getState()) works at runtime.
  const notificationStore = {
    notifications: [] as Array<{ id: string; type: string; message: string }>,
    addNotification: vi.fn(),
    removeNotification: vi.fn(),
    clear: vi.fn(),
    getState: vi.fn().mockReturnValue({
      notifications: [] as Array<{ id: string; type: string; message: string }>,
      add: vi.fn(),
      dismiss: vi.fn(),
      clear: vi.fn(),
    }),
  };

  const inventory = {
    listServers: vi.fn().mockResolvedValue([]),
    listActive: vi.fn().mockResolvedValue([]),
    listArchived: vi.fn().mockResolvedValue([]),
    getServer: vi.fn().mockResolvedValue(null),
    createServer: vi.fn().mockResolvedValue(undefined),
    updateServerStatus: vi.fn().mockResolvedValue(undefined),
    deleteServer: vi.fn().mockResolvedValue(undefined),
    updateServerIp: vi.fn().mockResolvedValue(undefined),
    archiveServer: vi.fn().mockResolvedValue(undefined),
    ...options.inventory,
  };

  const latency = {
    checkAll: vi.fn().mockResolvedValue([]),
    ...options.latency,
  };

  const rcon = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendCommand: vi.fn().mockResolvedValue({ requestId: 0, body: 'ok', type: 0 }),
    ...options.rcon,
  };

  const stats = {
    getStats: vi.fn().mockResolvedValue({ cpuPercent: '0', memUsage: '0', memPercent: '0', netIO: '0', blockIO: '0', pids: 0 }),
    getContainerStats: vi.fn().mockResolvedValue({ cpuPercent: '0', memUsage: '0/0', memPercent: '0', netIO: '0/0', blockIO: '0/0', pids: 0 } as ContainerStats),
    getLogSnapshot: vi.fn().mockResolvedValue([]),
    getRecentLogs: vi.fn().mockResolvedValue([]),
    streamLogs: vi.fn().mockResolvedValue(undefined),
    ...options.stats,
  };

  const deploy = {
    deploy: vi.fn().mockResolvedValue({ staticIp: '', instanceZone: '', success: true }),
    startServer: vi.fn().mockResolvedValue(undefined),
    stopServer: vi.fn().mockResolvedValue(undefined),
    changeInstanceType: vi.fn().mockResolvedValue(undefined),
    ...options.deploy,
  };

  const backup = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    ...options.backup,
  };

  const updateFlow = {
    checkForUpdates: vi.fn().mockResolvedValue({ available: false }),
    applyUpdate: vi.fn().mockResolvedValue(undefined),
    ...options.updateFlow,
  };

  const scheduler = {
    listTasks: vi.fn().mockResolvedValue([]),
    createTask: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    ...options.scheduler,
  };

  const archive = {
    listArchived: vi.fn().mockResolvedValue([]),
    archiveServer: vi.fn().mockResolvedValue(undefined),
    restoreServer: vi.fn().mockResolvedValue(undefined),
    ...options.archive,
  };

  return {
    services: {
      inventory,
      latency,
      rcon,
      stats,
      deploy,
      backup,
      updateFlow,
      scheduler,
      archive,
      notificationStore,
    },
    repositories: {
      localDb,
      sshGateway,
      sftpGateway,
      rconGateway,
      cloudProvider,
      filePicker,
      pinger,
    },
  } as unknown as MockServices;
}
