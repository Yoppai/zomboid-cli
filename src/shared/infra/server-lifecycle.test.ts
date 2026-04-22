import { expect, test, describe, afterEach, vi } from 'bun:test';
import { createAppContext, destroyAppContext } from '@/app/composition/composition-root.ts';
import { CdktfCloudProvider } from '@/shared/infra/cdktf/cdktf-cloud-provider.ts';
import { Ssh2Gateway } from '@/shared/infra/ssh/ssh2-gateway.ts';
import { Ssh2SftpGateway } from '@/shared/infra/ssh/ssh2-sftp-gateway.ts';
import { DeployService } from '@/features/server-deploy/services/deploy-service.ts';
import { InventoryService } from '@/features/server-dashboard/services/inventory-service.ts';
import { ArchiveService } from '@/features/archive/services/archive-service.ts';

describe('Integration: Server Lifecycle', () => {
  let context: any;

  afterEach(async () => {
    if (context) {
      await destroyAppContext(context);
      context = null;
    }
    vi.restoreAllMocks();
  });

  test('creates, starts, stops, and archives a server', async () => {
    // Create mocked instances
    const mockCloudProvider = {
      verifyAuth: vi.fn().mockResolvedValue(true),
      listProjects: vi.fn().mockResolvedValue([{ projectId: 'p-1', name: 'Test Project' }]),
      enableApis: vi.fn().mockResolvedValue(undefined),
      ensureStateBucket: vi.fn().mockResolvedValue('tf-state-bucket'),
      listZones: vi.fn().mockResolvedValue(['us-east1-b']),
      listMachineTypes: vi.fn().mockResolvedValue([{ id: 'e2-standard-2', label: 'Tier 1', totalRamGb: 8, serverMemoryGb: 6, maxPlayers: 8 }]),
      provision: vi.fn().mockResolvedValue({ success: true, staticIp: '1.1.1.1', instanceZone: 'us-east1-b' }),
      getInstanceStatus: vi.fn().mockResolvedValue('RUNNING'),
      destroy: vi.fn().mockResolvedValue({ success: true }),
      stopInstance: vi.fn().mockResolvedValue(undefined),
      startInstance: vi.fn().mockResolvedValue(undefined),
      changeMachineType: vi.fn().mockResolvedValue(undefined),
    } as any;
    
    const mockSshGateway = {
      testConnection: vi.fn().mockResolvedValue(true),
      exec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: 'running', stderr: '' }),
    } as any;
    
    const mockSftpGateway = {
      download: vi.fn().mockResolvedValue(undefined),
    } as any;
    
    context = await createAppContext(
      { dbPath: ':memory:' },
      {
        repositories: {
          cloudProvider: mockCloudProvider,
          sshGateway: mockSshGateway,
          sftpGateway: mockSftpGateway,
        }
      }
    );
    
    const { deploy, inventory, archive } = context.services;
    
    // 1. Deploy a new server
    const serverConfig = {
      name: 'test-server',
      provider: 'gcp',
      projectId: 'p-1',
      region: 'us-east1',
      zone: 'us-east1-b',
      machineType: { id: 'e2-standard-2', label: 'Tier 1', totalRamGb: 8, serverMemoryGb: 6, maxPlayers: 8 },
      gameBranch: 'stable',
      sshPrivateKey: 'fake-priv',
      sshPublicKey: 'fake-pub',
      rconPassword: 'fake-rcon'
    };
    
    const server = await deploy.deploy(serverConfig as any);
    expect(server.status).toBe('running');
    expect(server.staticIp).toBe('1.1.1.1');
    
    // 2. Stop server
    await deploy.stopServer(server.id);
    const stoppedServer = await inventory.getServer(server.id);
    expect(stoppedServer.status).toBe('stopped');
    
    // 3. Start server
    await deploy.startServer(server.id);
    const startedServer = await inventory.getServer(server.id);
    expect(startedServer.status).toBe('running');
    
    // 4. Archive server
    await deploy.stopServer(server.id);
    await archive.archive(server.id);
    
    const archivedServer = await inventory.getServer(server.id);
    expect(archivedServer.status).toBe('archived');
    expect(archivedServer.backupPath).toBeDefined();
  });
});
