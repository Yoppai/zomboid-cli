import React, { act } from 'react';
import { expect, test, describe, vi, beforeEach } from 'bun:test';
import { render } from 'ink-testing-library';

// Fix act(...) warnings
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

import { ServerDashboard } from '@/presentation/views/ServerDashboard.tsx';
import { ServerManagement } from '@/presentation/views/dashboard-tabs/ServerManagement.tsx';
import { BuildSelect } from '@/presentation/views/dashboard-tabs/BuildSelect.tsx';
import { PlayerManagement } from '@/presentation/views/dashboard-tabs/PlayerManagement.tsx';
import { ServiceProvider } from '@/presentation/hooks/use-services.tsx';

describe('ServerDashboard & Tabs (Group A)', () => {
  let inventoryMock: any;
  let deployMock: any;
  let rconMock: any;
  let updateFlowMock: any;
  let archiveMock: any;

  beforeEach(() => {
    inventoryMock = {
      getServer: vi.fn().mockResolvedValue({ id: 'srv-1', name: 'My Server', status: 'running', gameBranch: 'stable' }),
    };
    deployMock = {
      startServer: vi.fn(),
      stopServer: vi.fn(),
      changeInstanceType: vi.fn(),
    };
    updateFlowMock = {
      gracefulUpdate: vi.fn().mockResolvedValue(undefined),
    };
    archiveMock = {
      archive: vi.fn().mockResolvedValue({ backupPath: '/tmp/backup.tar.gz' }),
    };
    rconMock = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      players: vi.fn().mockResolvedValue([{ username: 'Survivor1' }]),
      kick: vi.fn().mockResolvedValue(undefined),
      ban: vi.fn().mockResolvedValue(undefined),
      broadcast: vi.fn().mockResolvedValue(undefined),
    };
  });

  function renderWithProviders(ui: React.ReactElement) {
    return render(
      <ServiceProvider services={{ inventory: inventoryMock, deploy: deployMock, rcon: rconMock, updateFlow: updateFlowMock, archive: archiveMock } as any}>
        {ui}
      </ServiceProvider>
    );
  }

  test('ServerDashboard renders 9 required dashboard sections', async () => {
    const { lastFrame } = renderWithProviders(<ServerDashboard serverId="srv-1" />);
    
    // Initial loading state
    expect(lastFrame()).toContain('Loading dashboard...');
    
    // Wait for the async inventory.get()
    await new Promise((r) => setTimeout(r, 20));
    
    const frame = lastFrame();
    expect(frame).toContain('Dashboard: My Server');
    expect(frame).toContain('Management');
    expect(frame).toContain('Build');
    expect(frame).toContain('Players');
    expect(frame).toContain('Stats');
    expect(frame).toContain('Basic');
    expect(frame).toContain('Advanced');
    expect(frame).toContain('Admins');
    expect(frame).toContain('Scheduler');
    expect(frame).toContain('Backups');
  });

  test('ServerManagement shows actions based on running status', () => {
    const server = { id: 'srv-1', name: 'S1', status: 'running', gameBranch: 'stable' } as any;
    const { lastFrame } = renderWithProviders(<ServerManagement server={server} />);
    const frame = lastFrame();
    
    expect(frame).toContain('Stop Server');
    expect(frame).toContain('Graceful Update');
    expect(frame).toContain('Change Instance Type');
    expect(frame).toContain('Archive Server');
  });

  test('ServerManagement shows actions based on stopped status', () => {
    const server = { id: 'srv-1', name: 'S1', status: 'stopped', gameBranch: 'stable' } as any;
    const { lastFrame } = renderWithProviders(<ServerManagement server={server} />);
    const frame = lastFrame();
    
    expect(frame).toContain('Start Server');
    expect(frame).toContain('Archive Server');
    expect(frame).toContain('Change Instance Type');
  });

  test('Graceful update requires explicit confirm and cancel is default', async () => {
    const server = { id: 'srv-1', name: 'S1', status: 'running', gameBranch: 'stable' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<ServerManagement server={server} />);
    });
    const { stdin, lastFrame } = result;

    // Move to Graceful Update (second action) and select
    await act(async () => {
      stdin.write('\x1B[B');
      await new Promise((r) => setTimeout(r, 10));
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(lastFrame()).toContain('Confirm');

    // ConfirmDialog default is cancel/no
    await act(async () => {
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(updateFlowMock.gracefulUpdate).not.toHaveBeenCalled();
  });

  test('Archive action calls archive service only after explicit confirmation', async () => {
    const server = { id: 'srv-1', name: 'S1', status: 'running', gameBranch: 'stable' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<ServerManagement server={server} />);
    });
    const { stdin } = result;

    // Move to Archive (4th action)
    await act(async () => {
      stdin.write('\x1B[B');
      await new Promise((r) => setTimeout(r, 10));
      stdin.write('\x1B[B');
      await new Promise((r) => setTimeout(r, 10));
      stdin.write('\x1B[B');
      await new Promise((r) => setTimeout(r, 10));
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 50));
    });

    // Explicit confirm
    await act(async () => {
      stdin.write('y');
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(archiveMock.archive).toHaveBeenCalledWith('srv-1');
  });

  test('Change instance type flow calls deploy.changeInstanceType after confirm', async () => {
    const server = { id: 'srv-1', name: 'S1', status: 'running', gameBranch: 'stable' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<ServerManagement server={server} />);
    });
    const { stdin, lastFrame } = result;

    // Move to Change Instance Type (3rd action)
    await act(async () => {
      stdin.write('\x1B[B');
      await new Promise((r) => setTimeout(r, 10));
      stdin.write('\x1B[B');
      await new Promise((r) => setTimeout(r, 10));
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(lastFrame()).toContain('Select Target Instance Type');

    // Select first target type and confirm
    await act(async () => {
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 50));
    });
    
    await act(async () => {
      stdin.write('y');
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(deployMock.changeInstanceType).toHaveBeenCalled();
  });


  test('BuildSelect shows current branch and options', () => {
    const server = { id: 'srv-1', name: 'S1', status: 'running', gameBranch: 'stable' } as any;
    const { lastFrame } = renderWithProviders(<BuildSelect server={server} />);
    const frame = lastFrame();
    
    expect(frame).toContain('Current Branch: stable');
    expect(frame).toContain('Unstable');
  });

  test('PlayerManagement connects to RCON and shows players', async () => {
    const server = { id: 'srv-1', name: 'S1', status: 'running', gameBranch: 'stable', staticIp: '1.2.3.4' } as any;
    const { lastFrame } = renderWithProviders(<PlayerManagement server={server} />);
    
    // initially connecting
    expect(lastFrame()).toContain('Connecting to RCON...');
    
    // await for the async connect
    await new Promise((r) => setTimeout(r, 20));
    
    const frame = lastFrame();
    expect(rconMock.connect).toHaveBeenCalled();
    expect(rconMock.players).toHaveBeenCalled();
    expect(frame).toContain('Survivor1');
  });

  test('PlayerManagement can kick a player', async () => {
    const server = { id: 'srv-1', name: 'S1', status: 'running', gameBranch: 'stable', staticIp: '1.2.3.4' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<PlayerManagement server={server} />);
    });
    const { lastFrame, stdin } = result;
    
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50)); // wait for connect
    });
    
    // Move focus to player list (it's after the broadcast input now)
    await act(async () => {
      stdin.write('\t');
      await new Promise((r) => setTimeout(r, 20));
    });

    // Select the first player (Survivor1)
    await act(async () => {
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 50));
    });
    
    expect(lastFrame()).toContain('Action for: Survivor1');
    expect(lastFrame()).toContain('Kick');

    // Select Kick
    await act(async () => {
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(rconMock.kick).toHaveBeenCalledWith('Survivor1');
  });

  test('PlayerManagement can ban a player', async () => {
    const server = { id: 'srv-1', name: 'S1', status: 'running', gameBranch: 'stable', staticIp: '1.2.3.4' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<PlayerManagement server={server} />);
    });
    const { stdin } = result;
    
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50)); // wait for connect
    });
    
    // Move focus to player list
    await act(async () => {
      stdin.write('\t');
      await new Promise((r) => setTimeout(r, 20));
    });

    // Select the first player
    await act(async () => {
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 50));
    });
    
    // Move to Ban (second option)
    await act(async () => {
      stdin.write('\x1B[B');
      await new Promise((r) => setTimeout(r, 10));
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(rconMock.ban).toHaveBeenCalledWith('Survivor1');
  });

  test('PlayerManagement can broadcast a message', async () => {
    const server = { id: 'srv-1', name: 'S1', status: 'running', gameBranch: 'stable', staticIp: '1.2.3.4' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<PlayerManagement server={server} />);
    });
    const { stdin } = result;
    
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200)); // wait for connect
    });
    
    // Type a message in the TextInput char by char
    for (const char of 'Hello World\r') {
      await act(async () => {
        stdin.write(char);
        await new Promise((r) => setTimeout(r, 10));
      });
    }

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100)); // wait for processing
    });

    expect(rconMock.broadcast).toHaveBeenCalledWith('Hello World');
  });
});
