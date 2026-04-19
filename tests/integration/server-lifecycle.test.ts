import { expect, test, describe, afterEach, vi } from 'bun:test';
import { createAppContext, destroyAppContext } from '@/composition-root.ts';
import { CdktfCloudProvider } from '@/infrastructure/cdktf/cdktf-cloud-provider.ts';
import { Ssh2Gateway } from '@/infrastructure/ssh/ssh2-gateway.ts';
import { Ssh2SftpGateway } from '@/infrastructure/ssh/ssh2-sftp-gateway.ts';

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
    // Mock the prototypes before context creation
    vi.spyOn(CdktfCloudProvider.prototype, 'provision').mockResolvedValue({ success: true, staticIp: '1.1.1.1', instanceZone: 'us-east1-b' });
    vi.spyOn(CdktfCloudProvider.prototype, 'getInstanceStatus').mockResolvedValue('RUNNING');
    vi.spyOn(CdktfCloudProvider.prototype, 'destroy').mockResolvedValue({ success: true });
    vi.spyOn(CdktfCloudProvider.prototype, 'stopInstance').mockResolvedValue(undefined);
    vi.spyOn(CdktfCloudProvider.prototype, 'startInstance').mockResolvedValue(undefined);
    
    vi.spyOn(Ssh2Gateway.prototype, 'testConnection').mockResolvedValue(true);
    vi.spyOn(Ssh2Gateway.prototype, 'exec').mockResolvedValue({ exitCode: 0, stdout: 'running', stderr: '' });
    
    vi.spyOn(Ssh2SftpGateway.prototype, 'download').mockResolvedValue(undefined);
    
    context = await createAppContext({ dbPath: ':memory:' });
    
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
