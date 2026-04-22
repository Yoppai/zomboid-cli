import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { ICloudProvider, ProvisionResult, ProvisionRequest } from '@/shared/infra/contracts/i-cloud-provider.ts';
import type { ISshGateway, CommandResult } from '@/shared/infra/contracts/i-ssh-gateway.ts';
import type { ILocalDb } from '@/shared/infra/contracts/i-local-db.ts';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { ServerConfig, MachineType, SshConnectionConfig } from '@/shared/infra/entities/value-objects.ts';
import type { ServerId, ServerStatus } from '@/shared/infra/entities/enums.ts';
import { createServerId } from '@/shared/infra/entities/enums.ts';
import {
  VmBootTimeoutError,
  CloudInitTimeoutError,
  CdktfProvisionError,
  SshConnectionError,
} from '@/shared/infra/entities/errors.ts';

// Production code that does NOT exist yet — guarantees RED
import { DeployService } from '@/features/server-deploy/services/deploy-service.ts';

// ── Helpers ──

const TEST_MACHINE_TYPE: MachineType = {
  id: 'e2-standard-2',
  label: 'Small Co-op (1-8)',
  totalRamGb: 8,
  serverMemoryGb: 6,
  maxPlayers: '1-8',
};

const TEST_CONFIG: ServerConfig = {
  name: 'my-zomboid',
  provider: 'gcp',
  projectId: 'my-project',
  region: 'us-central1',
  zone: 'us-central1-a',
  machineType: TEST_MACHINE_TYPE,
  gameBranch: 'stable',
  rconPassword: 'test-rcon-pass-1234567890abcdef',
  sshPublicKey: 'ssh-ed25519 AAAA... test@host',
  sshPrivateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
};

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
    status: 'provisioning' as ServerStatus,
    errorMessage: null,
    backupPath: null,
    createdAt: '2026-04-15T10:00:00Z',
    updatedAt: '2026-04-15T10:00:00Z',
    ...overrides,
  };
}

function createMockCloud(overrides: Partial<ICloudProvider> = {}): ICloudProvider {
  return {
    verifyAuth: mock(async () => true),
    listProjects: mock(async () => []),
    enableApis: mock(async () => {}),
    ensureStateBucket: mock(async () => 'zomboid-cli-tfstate-my-project'),
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

// No-op sleep for fast tests
const noOpSleep = async (_ms: number) => {};

// ── Tests ──

describe('DeployService', () => {
  let cloud: ICloudProvider;
  let ssh: ISshGateway;
  let db: ILocalDb;
  let svc: DeployService;

  beforeEach(() => {
    cloud = createMockCloud();
    ssh = createMockSsh();
    db = createMockDb();
    svc = new DeployService(cloud, ssh, db, {
      maxPollAttempts: 3,
      pollIntervalMs: 0,
      sleepFn: noOpSleep,
    });
  });

  // ── deploy ──

  describe('deploy', () => {
    it('should execute full deploy flow in correct order: create → provision → updateIp → sshPoll → healthCheck → running', async () => {
      const callOrder: string[] = [];

      db = createMockDb({
        createServer: mock(async () => {
          callOrder.push('createServer');
        }),
        updateServer: mock(async () => {
          callOrder.push('updateServer');
        }),
      });
      cloud = createMockCloud({
        provision: mock(async () => {
          callOrder.push('provision');
          return { staticIp: '34.120.5.1', instanceZone: 'us-central1-a', success: true };
        }),
      });
      ssh = createMockSsh({
        testConnection: mock(async () => {
          callOrder.push('testConnection');
          return true;
        }),
        exec: mock(async () => {
          callOrder.push('healthCheck');
          return { stdout: 'zomboid-server   running', stderr: '', exitCode: 0 };
        }),
      });

      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      const result = await svc.deploy(TEST_CONFIG);

      // Verify correct ORDER
      expect(callOrder[0]).toBe('createServer');
      expect(callOrder[1]).toBe('provision');
      expect(callOrder[2]).toBe('updateServer'); // save IP
      expect(callOrder).toContain('testConnection');
      expect(callOrder).toContain('healthCheck');
      // Last updateServer is status='running'
      expect(result.status).toBe('running');
    });

    it('should create server record with status provisioning', async () => {
      let capturedRecord: ServerRecord | null = null;

      db = createMockDb({
        createServer: mock(async (record: ServerRecord) => {
          capturedRecord = record;
        }),
        updateServer: mock(async () => {}),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await svc.deploy(TEST_CONFIG);

      expect(capturedRecord).not.toBeNull();
      expect(capturedRecord!.status).toBe('provisioning');
      expect(capturedRecord!.name).toBe('my-zomboid');
      expect(capturedRecord!.provider).toBe('gcp');
      expect(capturedRecord!.projectId).toBe('my-project');
      expect(capturedRecord!.instanceType).toBe('e2-standard-2');
      expect(capturedRecord!.instanceZone).toBe('us-central1-a');
      expect(capturedRecord!.gameBranch).toBe('stable');
      expect(capturedRecord!.staticIp).toBeNull();
      expect(capturedRecord!.id).toBeTruthy();
    });

    it('should save static IP from provision result', async () => {
      const updateCalls: Array<{ id: string; fields: Record<string, unknown> }> = [];

      db = createMockDb({
        createServer: mock(async () => {}),
        updateServer: mock(async (id: ServerId, fields: Record<string, unknown>) => {
          updateCalls.push({ id, fields });
        }),
      });
      cloud = createMockCloud({
        provision: mock(async () => ({
          staticIp: '35.222.100.50',
          instanceZone: 'us-central1-a',
          success: true,
        })),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await svc.deploy(TEST_CONFIG);

      // First updateServer should set staticIp
      const ipUpdate = updateCalls.find((c) => c.fields.staticIp !== undefined);
      expect(ipUpdate).toBeDefined();
      expect(ipUpdate!.fields.staticIp).toBe('35.222.100.50');
    });

    it('should set status to failed when provision fails', async () => {
      const updateCalls: Array<{ fields: Record<string, unknown> }> = [];

      db = createMockDb({
        createServer: mock(async () => {}),
        updateServer: mock(async (_id: ServerId, fields: Record<string, unknown>) => {
          updateCalls.push({ fields });
        }),
      });
      cloud = createMockCloud({
        provision: mock(async () => ({
          staticIp: '',
          instanceZone: '',
          success: false,
          error: 'Quota exceeded',
        })),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await expect(svc.deploy(TEST_CONFIG)).rejects.toThrow(CdktfProvisionError);

      // Should have set status to 'failed'
      const failUpdate = updateCalls.find((c) => c.fields.status === 'failed');
      expect(failUpdate).toBeDefined();
      expect(failUpdate!.fields.errorMessage).toContain('Infrastructure provisioning failed');
      expect(failUpdate!.fields.errorMessage).toContain('Quota exceeded');
    });

    it('should throw VmBootTimeoutError when VM never reaches RUNNING', async () => {
      db = createMockDb({
        createServer: mock(async () => {}),
        updateServer: mock(async () => {}),
      });
      cloud = createMockCloud({
        getInstanceStatus: mock(async () => 'STAGING' as const),
      });
      ssh = createMockSsh({
        testConnection: mock(async () => true),
        exec: mock(async () => ({ stdout: '', stderr: '', exitCode: 1 })),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 2, // will exhaust quickly
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await expect(svc.deploy(TEST_CONFIG)).rejects.toThrow(VmBootTimeoutError);

      // Should have set status to 'failed'
      expect(db.updateServer).toHaveBeenCalled();
    });

    it('should throw CloudInitTimeoutError when VM is RUNNING but health never becomes ready', async () => {
      db = createMockDb({
        createServer: mock(async () => {}),
        updateServer: mock(async () => {}),
      });
      cloud = createMockCloud({
        getInstanceStatus: mock(async () => 'RUNNING' as const),
      });
      ssh = createMockSsh({
        testConnection: mock(async () => true),
        exec: mock(async () => ({ stdout: 'container exited', stderr: '', exitCode: 0 })),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 2,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await expect(svc.deploy(TEST_CONFIG)).rejects.toThrow(CloudInitTimeoutError);
      expect(db.updateServer).toHaveBeenCalled();
    });

    it('should return server record with running status and static IP on success', async () => {
      db = createMockDb({
        createServer: mock(async () => {}),
        updateServer: mock(async () => {}),
      });

      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      const result = await svc.deploy(TEST_CONFIG);

      expect(result.status).toBe('running');
      expect(result.staticIp).toBe('34.120.5.1');
      expect(result.name).toBe('my-zomboid');
    });

    it('should call cloud.provision with a valid ProvisionRequest', async () => {
      let capturedRequest: ProvisionRequest | null = null;

      cloud = createMockCloud({
        provision: mock(async (req: ProvisionRequest) => {
          capturedRequest = req;
          return { staticIp: '34.120.5.1', instanceZone: 'us-central1-a', success: true };
        }),
      });
      db = createMockDb({
        createServer: mock(async () => {}),
        updateServer: mock(async () => {}),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await svc.deploy(TEST_CONFIG);

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.config).toBe(TEST_CONFIG);
      expect(capturedRequest!.cloudInitScript).toBeTruthy();
      expect(capturedRequest!.tfStateBucket).toContain('my-project');
    });
  });

  // ── startServer ──

  describe('startServer', () => {
    it('should start container via SSH and update status to running', async () => {
      const server = makeServerRecord({
        status: 'stopped',
        staticIp: '34.120.5.1',
      });
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await svc.startServer(server.id);

      expect(ssh.exec).toHaveBeenCalledWith(
        expect.objectContaining({ host: '34.120.5.1' }),
        'docker compose -f /opt/zomboid/docker-compose.yml up -d',
      );
      expect(cloud.startInstance).not.toHaveBeenCalled();
      expect(db.updateServer).toHaveBeenCalled();
    });

    it('should propagate SSH unreachable error with retry option and keep status unchanged', async () => {
      const server = makeServerRecord({
        status: 'stopped',
        staticIp: '34.120.5.1',
      });

      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      ssh = createMockSsh({
        exec: mock(async () => {
          throw new SshConnectionError('34.120.5.1', new Error('connect ETIMEDOUT'));
        }),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      try {
        await svc.startServer(server.id);
        throw new Error('expected startServer to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(SshConnectionError);
        expect(error).toMatchObject({
          recoveryOptions: expect.arrayContaining(['retry']),
        });
      }
      expect(db.updateServer).not.toHaveBeenCalledWith(
        server.id,
        expect.objectContaining({ status: 'running' }),
      );
    });
  });

  // ── stopServer ──

  describe('stopServer', () => {
    it('should stop container via SSH and update status to stopped', async () => {
      const server = makeServerRecord({
        status: 'running',
        staticIp: '34.120.5.1',
      });
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await svc.stopServer(server.id);

      expect(ssh.exec).toHaveBeenCalledWith(
        expect.objectContaining({ host: '34.120.5.1' }),
        'docker compose -f /opt/zomboid/docker-compose.yml down',
      );
      expect(cloud.stopInstance).not.toHaveBeenCalled();
      expect(db.updateServer).toHaveBeenCalled();
    });

    it('should fail when server has no static IP for SSH lifecycle command', async () => {
      const server = makeServerRecord({
        status: 'running',
        staticIp: null,
      });
      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await expect(svc.stopServer(server.id)).rejects.toThrow('static IP');
    });
  });

  // ── changeInstanceType ──

  describe('changeInstanceType', () => {
    it('should stop, resize, and start in correct order', async () => {
      const callOrder: string[] = [];
      const server = makeServerRecord({
        status: 'running',
        staticIp: '34.120.5.1',
      });

      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      cloud = createMockCloud({
        stopInstance: mock(async () => {
          callOrder.push('stop');
        }),
        changeMachineType: mock(async () => {
          callOrder.push('resize');
        }),
        startInstance: mock(async () => {
          callOrder.push('start');
        }),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      const newType: MachineType = {
        id: 'n2-standard-4',
        label: 'Community (16-32)',
        totalRamGb: 16,
        serverMemoryGb: 12,
        maxPlayers: '16-32',
      };

      await svc.changeInstanceType(server.id, newType);

      expect(callOrder).toEqual(['stop', 'resize', 'start']);
    });

    it('should update instance type in DB after resize', async () => {
      const server = makeServerRecord({
        status: 'running',
        staticIp: '34.120.5.1',
      });
      const updateCalls: Array<{ fields: Record<string, unknown> }> = [];

      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async (_id: ServerId, fields: Record<string, unknown>) => {
          updateCalls.push({ fields });
        }),
      });
      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      const newType: MachineType = {
        id: 'c2-standard-8',
        label: 'Massive (64+)',
        totalRamGb: 32,
        serverMemoryGb: 26,
        maxPlayers: '64+',
      };

      await svc.changeInstanceType(server.id, newType);

      const typeUpdate = updateCalls.find((c) => c.fields.instanceType !== undefined);
      expect(typeUpdate).toBeDefined();
      expect(typeUpdate!.fields.instanceType).toBe('c2-standard-8');
    });

    it('should update remote compose SERVER_MEMORY and restart container after resize', async () => {
      const server = makeServerRecord({
        status: 'running',
        staticIp: '34.120.5.1',
      });
      const sshCalls: string[] = [];

      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      ssh = createMockSsh({
        exec: mock(async (_conn, command: string) => {
          sshCalls.push(command);
          return { stdout: '', stderr: '', exitCode: 0 };
        }),
      });

      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await svc.changeInstanceType(server.id, {
        id: 'n2-standard-4',
        label: 'Community (16-32)',
        totalRamGb: 16,
        serverMemoryGb: 12,
        maxPlayers: '16-32',
      });

      expect(sshCalls.some((cmd) => cmd.includes('docker compose -f /opt/zomboid/docker-compose.yml down'))).toBe(true);
      expect(sshCalls.some((cmd) => cmd.includes('SERVER_MEMORY=12g'))).toBe(true);
      expect(sshCalls.some((cmd) => cmd.includes('docker compose -f /opt/zomboid/docker-compose.yml up -d'))).toBe(true);
    });

    it('should rollback machine type and container when resize fails', async () => {
      const server = makeServerRecord({
        status: 'running',
        staticIp: '34.120.5.1',
        instanceType: 'e2-standard-2',
      });

      const machineTypeCalls: string[] = [];

      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      cloud = createMockCloud({
        changeMachineType: mock(async (_project, _zone, _instance, machineType) => {
          machineTypeCalls.push(machineType);
          if (machineType === 'n2-standard-4') {
            throw new Error('quota exceeded');
          }
        }),
      });
      ssh = createMockSsh({
        exec: mock(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
      });

      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await expect(
        svc.changeInstanceType(server.id, {
          id: 'n2-standard-4',
          label: 'Community (16-32)',
          totalRamGb: 16,
          serverMemoryGb: 12,
          maxPlayers: '16-32',
        }),
      ).rejects.toThrow();

      expect(machineTypeCalls).toContain('n2-standard-4');
      expect(machineTypeCalls).toContain('e2-standard-2');
      expect(db.updateServer).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ instanceType: 'n2-standard-4' }),
      );
    });

    it('should rollback when compose update fails after successful resize', async () => {
      const server = makeServerRecord({
        status: 'running',
        staticIp: '34.120.5.1',
        instanceType: 'e2-standard-2',
      });

      const machineTypeCalls: string[] = [];

      db = createMockDb({
        getServer: mock(async () => server),
        updateServer: mock(async () => {}),
      });
      cloud = createMockCloud({
        changeMachineType: mock(async (_project, _zone, _instance, machineType) => {
          machineTypeCalls.push(machineType);
        }),
      });
      ssh = createMockSsh({
        exec: mock(async (_conn, command: string) => {
          if (command.includes('SERVER_MEMORY=12g')) {
            throw new Error('sed failed');
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        }),
      });

      svc = new DeployService(cloud, ssh, db, {
        maxPollAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: noOpSleep,
      });

      await expect(
        svc.changeInstanceType(server.id, {
          id: 'n2-standard-4',
          label: 'Community (16-32)',
          totalRamGb: 16,
          serverMemoryGb: 12,
          maxPlayers: '16-32',
        }),
      ).rejects.toThrow();

      expect(machineTypeCalls).toEqual(expect.arrayContaining(['n2-standard-4', 'e2-standard-2']));
      expect(db.updateServer).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ instanceType: 'n2-standard-4' }),
      );
    });
  });
});
