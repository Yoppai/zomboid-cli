import React from 'react';
import { expect, test, describe, vi, beforeEach } from 'bun:test';
import { render } from 'ink-testing-library';
import {
  ErrorRecoveryPanel,
  buildRecoveryActions,
  executeRecoveryAction,
  resolveRecoveryPhase,
} from '@/features/server-dashboard/components/dashboard-tabs/ErrorRecoveryPanel';
import { ServerDashboard } from '@/features/server-dashboard/components/ServerDashboard';
import { ErrorBox } from '@/shared/components/common/ErrorBox.tsx';
import { ServiceProvider } from '@/shared/hooks/use-services.tsx';

describe('Error Recovery Flows', () => {
  let inventoryMock: any;
  let deployMock: any;
  let archiveMock: any;
  let statsMock: any;
  let sshGatewayMock: any;
  let cloudProviderMock: any;
  let localDbMock: any;
  
  beforeEach(() => {
    inventoryMock = {
      getServer: vi.fn().mockResolvedValue({ 
        id: 'srv-1', 
        name: 'Failed Server', 
        status: 'failed', 
        errorMessage: 'Something went wrong',
      }),
    };
    deployMock = {
      startServer: vi.fn().mockResolvedValue(undefined),
    };
    archiveMock = {
      archive: vi.fn().mockResolvedValue({ backupPath: '/tmp/backup.tar.gz' }),
    };
    statsMock = {
      getLogSnapshot: vi.fn().mockResolvedValue('cloud-init log line'),
      getRecentLogs: vi.fn().mockResolvedValue(['log line']),
    };
    sshGatewayMock = {
      exec: vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 }),
    };
    cloudProviderMock = {
      destroy: vi.fn().mockResolvedValue({ success: true }),
      getInstanceStatus: vi.fn().mockResolvedValue('RUNNING'),
      stopInstance: vi.fn().mockResolvedValue(undefined),
      startInstance: vi.fn().mockResolvedValue(undefined),
    };
    localDbMock = {
      updateServer: vi.fn().mockResolvedValue(undefined),
    };
  });

  function renderWithProviders(ui: React.ReactElement) {
    return render(
      <ServiceProvider services={{ inventory: inventoryMock, deploy: deployMock, archive: archiveMock, stats: statsMock, sshGateway: sshGatewayMock, cloudProvider: cloudProviderMock, localDb: localDbMock } as any}>
        {ui}
      </ServiceProvider>
    );
  }

  test('phase1 retry_deploy retries deploy flow (not generic startServer)', async () => {
    const deployFlowMock = vi.fn().mockResolvedValue(undefined);
    const server = {
      id: 'srv-1',
      name: 'alpha',
      provider: 'gcp',
      projectId: 'my-project',
      instanceZone: 'us-east1-b',
      instanceType: 'e2-standard-2',
      gameBranch: 'stable',
      rconPassword: 'pass',
      sshPrivateKey: 'key',
      staticIp: '10.0.0.1',
      errorMessage: 'cdktf apply failed',
    } as any;

    await executeRecoveryAction('retry_deploy', server, {
      deploy: {
        deploy: deployFlowMock,
        startServer: deployMock.startServer,
      },
      archive: archiveMock,
      stats: statsMock,
      sshGateway: sshGatewayMock,
      cloudProvider: cloudProviderMock,
      localDb: localDbMock,
    } as any);

    expect(deployFlowMock).toHaveBeenCalledTimes(1);
    expect(deployMock.startServer).not.toHaveBeenCalled();
  });

  test('phase2 retry_vm_boot reboots VM (stop + start) and persists failed state timestamp', async () => {
    const server = {
      id: 'srv-1',
      name: 'alpha',
      projectId: 'my-project',
      instanceZone: 'us-east1-b',
      sshPrivateKey: 'key',
      staticIp: '10.0.0.1',
      errorMessage: 'VM boot timeout',
    } as any;

    await executeRecoveryAction('retry_vm_boot', server, {
      deploy: deployMock,
      archive: archiveMock,
      stats: statsMock,
      sshGateway: sshGatewayMock,
      cloudProvider: cloudProviderMock,
      localDb: localDbMock,
    } as any);

    expect(cloudProviderMock.stopInstance).toHaveBeenCalledWith('my-project', 'us-east1-b', 'zomboid-alpha');
    expect(cloudProviderMock.startInstance).toHaveBeenCalledWith('my-project', 'us-east1-b', 'zomboid-alpha');
    expect(localDbMock.updateServer).toHaveBeenCalledWith(
      'srv-1',
      expect.objectContaining({ status: 'failed' }),
    );
    expect(deployMock.startServer).not.toHaveBeenCalled();
  });

  test('phase3 view_cloud_init_logs fetches cloud-init file over SSH', async () => {
    const server = {
      id: 'srv-1',
      name: 'alpha',
      projectId: 'my-project',
      instanceZone: 'us-east1-b',
      sshPrivateKey: 'key',
      staticIp: '10.0.0.1',
      errorMessage: 'Cloud-init bootstrap timeout',
    } as any;

    await executeRecoveryAction('view_cloud_init_logs', server, {
      deploy: deployMock,
      archive: archiveMock,
      stats: statsMock,
      sshGateway: sshGatewayMock,
      cloudProvider: cloudProviderMock,
      localDb: localDbMock,
    } as any);

    expect(sshGatewayMock.exec).toHaveBeenCalledWith(
      expect.objectContaining({ host: '10.0.0.1', username: 'root' }),
      'cat /var/log/cloud-init-output.log',
    );
  });

  test('phase3 rerun_bootstrap re-executes bootstrap script over SSH', async () => {
    const server = {
      id: 'srv-1',
      name: 'alpha',
      projectId: 'my-project',
      instanceZone: 'us-east1-b',
      sshPrivateKey: 'key',
      staticIp: '10.0.0.1',
      errorMessage: 'Cloud-init bootstrap timeout',
    } as any;

    await executeRecoveryAction('rerun_bootstrap', server, {
      deploy: deployMock,
      archive: archiveMock,
      stats: statsMock,
      sshGateway: sshGatewayMock,
      cloudProvider: cloudProviderMock,
      localDb: localDbMock,
    } as any);

    expect(sshGatewayMock.exec).toHaveBeenCalledWith(
      expect.objectContaining({ host: '10.0.0.1', username: 'root' }),
      expect.stringContaining('/var/lib/cloud/instance/scripts/user-data'),
    );
  });

  test('phase4 restart_container executes docker compose restart over SSH', async () => {
    const server = {
      id: 'srv-1',
      name: 'alpha',
      projectId: 'my-project',
      instanceZone: 'us-east1-b',
      sshPrivateKey: 'key',
      staticIp: '10.0.0.1',
      errorMessage: 'Container crash detected after deploy',
    } as any;

    await executeRecoveryAction('restart_container', server, {
      deploy: deployMock,
      archive: archiveMock,
      stats: statsMock,
      sshGateway: sshGatewayMock,
      cloudProvider: cloudProviderMock,
      localDb: localDbMock,
    } as any);

    expect(sshGatewayMock.exec).toHaveBeenCalledWith(
      expect.objectContaining({ host: '10.0.0.1', username: 'root' }),
      'docker compose -f /opt/zomboid/docker-compose.yml restart',
    );
  });

  test('phase4 view_logs fetches container logs over SSH', async () => {
    const server = {
      id: 'srv-1',
      name: 'alpha',
      projectId: 'my-project',
      instanceZone: 'us-east1-b',
      sshPrivateKey: 'key',
      staticIp: '10.0.0.1',
      errorMessage: 'Container crash detected after deploy',
    } as any;

    await executeRecoveryAction('view_logs', server, {
      deploy: deployMock,
      archive: archiveMock,
      stats: statsMock,
      sshGateway: sshGatewayMock,
      cloudProvider: cloudProviderMock,
      localDb: localDbMock,
    } as any);

    expect(sshGatewayMock.exec).toHaveBeenCalledWith(
      expect.objectContaining({ host: '10.0.0.1', username: 'root' }),
      'docker logs --tail 50 zomboid-server 2>&1',
    );
  });

  test('phase5 retry_operation retries operational path without destroy', async () => {
    const server = {
      id: 'srv-1',
      name: 'alpha',
      projectId: 'my-project',
      instanceZone: 'us-east1-b',
      sshPrivateKey: 'key',
      staticIp: '10.0.0.1',
      errorMessage: 'SSH command timeout while opening tunnel',
    } as any;

    await executeRecoveryAction('retry_operation', server, {
      deploy: deployMock,
      archive: archiveMock,
      stats: statsMock,
      sshGateway: sshGatewayMock,
      cloudProvider: cloudProviderMock,
      localDb: localDbMock,
    } as any);

    expect(cloudProviderMock.destroy).not.toHaveBeenCalled();
    expect(cloudProviderMock.stopInstance).not.toHaveBeenCalled();
    expect(cloudProviderMock.startInstance).not.toHaveBeenCalled();
  });

  test('phase matrix resolves actions for phases 1..5 with mandatory fixed options', () => {
    const phase1 = buildRecoveryActions(resolveRecoveryPhase('cdktf apply failed due to terraform error'));
    const phase2 = buildRecoveryActions(resolveRecoveryPhase('VM boot timeout after 3 minutes'));
    const phase3 = buildRecoveryActions(resolveRecoveryPhase('Cloud-init bootstrap timeout after 5 minutes'));
    const phase4 = buildRecoveryActions(resolveRecoveryPhase('Container crash detected after deploy'));
    const phase5 = buildRecoveryActions(resolveRecoveryPhase('SSH command timeout while opening tunnel'));

    expect(phase1).toEqual(expect.arrayContaining(['retry_deploy', 'destroy_partial', 'abort']));
    expect(phase2).toEqual(expect.arrayContaining(['vm_diagnostics', 'retry_vm_boot', 'destroy']));
    expect(phase3).toEqual(expect.arrayContaining(['view_cloud_init_logs', 'rerun_bootstrap', 'destroy']));
    expect(phase4).toEqual(expect.arrayContaining(['view_logs', 'restart_container', 'reconfigure']));
    expect(phase5).toEqual(expect.arrayContaining(['retry_operation']));
    expect(phase5).not.toContain('destroy');

    for (const options of [phase1, phase2, phase3, phase4, phase5]) {
      expect(options).toEqual(expect.arrayContaining(['retry_deploy', 'archive', 'ssh_manual']));
    }
  });

  test('executes destroy_partial action with cloud destroy + failed persistence', async () => {
    const server = {
      id: 'srv-1',
      name: 'Failed Server',
      projectId: 'my-project',
      instanceZone: 'us-east1-b',
      sshPrivateKey: 'key',
      staticIp: '10.0.0.1',
      errorMessage: 'cdktf apply failed',
    } as any;

    await executeRecoveryAction('destroy_partial', server, {
      deploy: deployMock,
      archive: archiveMock,
      stats: statsMock,
      cloudProvider: cloudProviderMock,
      localDb: localDbMock,
    } as any);

    expect(cloudProviderMock.destroy).toHaveBeenCalledWith(
      'srv-1',
      'zomboid-cli-tfstate-my-project',
      'my-project',
    );
    expect(localDbMock.updateServer).toHaveBeenCalledWith(
      'srv-1',
      expect.objectContaining({ status: 'failed' }),
    );
  });

  test('executes VM diagnostics action querying cloud instance state', async () => {
    const server = {
      id: 'srv-1',
      name: 'alpha',
      projectId: 'my-project',
      instanceZone: 'us-east1-b',
      sshPrivateKey: 'key',
      staticIp: '10.0.0.1',
      errorMessage: 'VM boot timeout',
    } as any;

    await executeRecoveryAction('vm_diagnostics', server, {
      deploy: deployMock,
      archive: archiveMock,
      stats: statsMock,
      cloudProvider: cloudProviderMock,
      localDb: localDbMock,
    } as any);

    expect(cloudProviderMock.getInstanceStatus).toHaveBeenCalledWith(
      'my-project',
      'us-east1-b',
      'zomboid-alpha',
    );
  });

  test('ErrorBox renders recovery buttons and calls handlers', () => {
    const onRetry = vi.fn();
    const onSsh = vi.fn();

    const { lastFrame, stdin } = render(
      <ErrorBox 
        code="TEST_ERROR" 
        message="A test error" 
        options={['retry', 'ssh_manual']} 
        onAction={(action) => {
          if (action === 'retry') onRetry();
          if (action === 'ssh_manual') onSsh();
        }}
      />
    );

    const frame = lastFrame();
    expect(frame).toContain('TEST_ERROR');
    expect(frame).toContain('A test error');
    expect(frame).toContain('Retry');
    expect(frame).toContain('SSH');

    // Default selection is usually first. Let's hit enter.
    stdin.write('\r');
    expect(onRetry).toHaveBeenCalled();
  });

  test('ErrorRecoveryPanel displays for failed server', () => {
    const server = { id: 'srv-1', status: 'failed', errorMessage: 'CDKTF_PROVISION_ERROR' } as any;
    const { lastFrame } = renderWithProviders(<ErrorRecoveryPanel server={server} />);
    
    expect(lastFrame()).toContain('Error Recovery');
    expect(lastFrame()).toContain('CDKTF_PROVISION_ERROR');
  });

  test('shows contextual phase 3 actions for cloud-init timeout', () => {
    const server = {
      id: 'srv-1',
      status: 'failed',
      errorMessage: 'Cloud-init bootstrap timeout after 5 minutes',
    } as any;
    const { lastFrame } = renderWithProviders(<ErrorRecoveryPanel server={server} />);

    const frame = lastFrame() ?? '';
    expect(frame).toContain('View cloud-init logs');
    expect(frame).toContain('Retry');
    expect(frame).toContain('SSH');
    expect(frame).toContain('Destroy');
  });

  test('does not offer destroy for operational SSH/RCON errors', () => {
    const server = {
      id: 'srv-1',
      status: 'failed',
      errorMessage: 'SSH command timeout to server',
    } as any;
    const { lastFrame } = renderWithProviders(<ErrorRecoveryPanel server={server} />);

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Retry');
    expect(frame).toContain('SSH');
    expect(frame).not.toContain('Destroy');
  });

  test('failed dashboard always shows fixed options: Retry Deploy + Archive + SSH', () => {
    const server = {
      id: 'srv-1',
      status: 'failed',
      errorMessage: 'SSH command timeout to server',
      projectId: 'my-project',
      instanceZone: 'us-east1-b',
      sshPrivateKey: 'key',
      staticIp: '10.0.0.1',
    } as any;
    const { lastFrame } = renderWithProviders(<ErrorRecoveryPanel server={server} />);

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Retry Deploy');
    expect(frame).toContain('Archive');
    expect(frame).toContain('SSH');
  });

  test('requires explicit confirmation for destroy/archive with default cancel', async () => {
    const server = {
      id: 'srv-1',
      status: 'failed',
      errorMessage: 'cdktf apply failed with partial resources',
    } as any;
    const { stdin, lastFrame } = renderWithProviders(<ErrorRecoveryPanel server={server} />);

    // Move to destructive option and select
    stdin.write('\x1B[B');
    stdin.write('\r');

    await new Promise((r) => setTimeout(r, 20));
    expect(lastFrame()).toContain('Confirm');

    // Enter on default selection (cancel)
    stdin.write('\r');
    await new Promise((r) => setTimeout(r, 20));

    expect(archiveMock.archive).not.toHaveBeenCalled();
  });

  test('ServerDashboard shows ErrorRecoveryPanel when status is failed', async () => {
    const { lastFrame } = renderWithProviders(<ServerDashboard serverId="srv-1" />);
    
    // Wait for the async inventory.get()
    await new Promise((r) => setTimeout(r, 20));
    
    const frame = lastFrame();
    expect(frame).toContain('Dashboard: Failed Server');
    // It should render ErrorRecoveryPanel instead of Tabs or above Tabs
    expect(frame).toContain('Error Recovery');
    expect(frame).toContain('Something went wrong');
  });
});
