import React, { act } from 'react';
import { expect, test, describe, vi, beforeEach } from 'bun:test';
import { render } from 'ink-testing-library';
import { Box, Text } from 'ink';

// Fix act(...) warnings
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

import { ServerStats } from '@/features/server-dashboard/components/dashboard-tabs/ServerStats';
import { BasicSettings } from '@/features/server-dashboard/components/dashboard-tabs/BasicSettings';
import { AdvancedSettings } from '@/features/server-dashboard/components/dashboard-tabs/AdvancedSettings';
import { AdminSettings } from '@/features/server-dashboard/components/dashboard-tabs/AdminSettings';
import { SchedulerPanel } from '@/features/scheduler/components/SchedulerPanel';
import { BackupsPanel } from '@/features/backups/components/BackupsPanel';
import { ServiceProvider } from '@/shared/hooks/use-services.tsx';

let lastOnSelect: any = null;
vi.mock('@/shared/components/common/FilePickerButton.tsx', () => ({
  FilePickerButton: ({ label, onSelect }: any) => {
    if (label === 'Select SandboxVars.lua') {
      lastOnSelect = onSelect;
    }
    return (
      <Box>
        <Text>{label}</Text>
      </Box>
    );
  }
}));

describe('Dashboard Tabs (Group B)', () => {
  let statsMock: any;
  let schedulerMock: any;
  let backupMock: any;
  let sftpMock: any;
  let notificationMock: any;

  beforeEach(() => {
    statsMock = {
      getContainerStats: vi.fn().mockResolvedValue({
        cpuPercent: '5.0%', memUsage: '1GB', memPercent: '12%', netIO: '1MB/2MB', blockIO: '0B/0B', pids: 10
      }),
      getLogSnapshot: vi.fn().mockResolvedValue('log line 1\nlog line 2'),
    };
    schedulerMock = {
      listTasks: vi.fn().mockResolvedValue([{ id: 't1', type: 'auto_backup', cronExpression: '0 4 * * *', enabled: 1 }]),
      addTask: vi.fn().mockResolvedValue(undefined),
    };
    backupMock = {
      list: vi.fn().mockResolvedValue([{ filename: 'backup1.tar.gz', sizeBytes: 1048576, createdAt: '2026-01-01' }]),
      create: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(undefined),
    };
    sftpMock = {
      upload: vi.fn().mockResolvedValue(undefined),
    };
    notificationMock = {
      getState: () => ({
        add: vi.fn(),
      }),
    };
  });

  function renderWithProviders(ui: React.ReactElement) {
    return render(
      <ServiceProvider services={{ 
        stats: statsMock, 
        scheduler: schedulerMock, 
        backup: backupMock,
        sftpGateway: sftpMock,
        notificationStore: notificationMock
      } as any}>
        {ui}
      </ServiceProvider>
    );
  }

  test('ServerStats shows stats and logs', async () => {
    const server = { id: 'srv-1', status: 'running', staticIp: '1.2.3.4' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<ServerStats server={server} />);
    });
    const { lastFrame } = result;
    
    // allow effects to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    
    const frame = lastFrame();
    expect(statsMock.getContainerStats).toHaveBeenCalled();
    expect(frame).toContain('CPU Usage: 5.0%');
    expect(frame).toContain('1MB/2MB');
  });

  test('ServerStats shows error if not running', async () => {
    const server = { id: 'srv-1', status: 'stopped' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<ServerStats server={server} />);
    });
    expect(result.lastFrame()).toContain('Stats are only available when the server is running.');
  });

  test('BasicSettings shows inputs', async () => {
    const server = { id: 'srv-1', name: 'My Server' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<BasicSettings server={server} />);
    });
    expect(result.lastFrame()).toContain('Public Server Name');
  });

  test('AdvancedSettings shows file pickers', async () => {
    const server = { id: 'srv-1' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<AdvancedSettings server={server} />);
    });
    expect(result.lastFrame()).toContain('Select SandboxVars.lua');
  });

  test('AdvancedSettings calls sftp upload when file is selected', async () => {
    const server = { id: 'srv-1', staticIp: '1.2.3.4', sshPrivateKey: 'key' } as any;
    await act(async () => {
      renderWithProviders(<AdvancedSettings server={server} />);
    });
    
    expect(lastOnSelect).toBeDefined();
    
    // Simulate selection
    await act(async () => {
      await lastOnSelect('/path/to/SandboxVars.lua');
    });
    
    expect(sftpMock.upload).toHaveBeenCalledWith(
      expect.objectContaining({ host: '1.2.3.4' }),
      '/path/to/SandboxVars.lua',
      '/opt/zomboid/config/SandboxVars.lua'
    );
  });

  test('AdminSettings shows RCON password', async () => {
    const server = { id: 'srv-1', rconPassword: 'secret-rcon' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<AdminSettings server={server} />);
    });
    expect(result.lastFrame()).toContain('secret-rcon');
  });

  test('SchedulerPanel lists tasks and can create', async () => {
    const server = { id: 'srv-1', staticIp: '1.2.3.4' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<SchedulerPanel server={server} />);
    });
    
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    
    const frame = result.lastFrame();
    expect(frame).toContain('auto_backup');
    expect(frame).toContain('0 4 * * *');
  });

  test('BackupsPanel lists backups and can restore', async () => {
    const server = { id: 'srv-1', name: 's1' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<BackupsPanel server={server} />);
    });
    
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    
    const frame = result.lastFrame();
    expect(frame).toContain('backup1.tar.gz');
    expect(frame).toContain('Restore'); 
  });


  test('ServerStats shows error if not running', () => {
    const server = { id: 'srv-1', status: 'stopped' } as any;
    const { lastFrame } = renderWithProviders(<ServerStats server={server} />);
    expect(lastFrame()).toContain('Stats are only available when the server is running.');
  });

  test('BasicSettings shows inputs', () => {
    const server = { id: 'srv-1', name: 'My Server' } as any;
    const { lastFrame } = renderWithProviders(<BasicSettings server={server} />);
    expect(lastFrame()).toContain('Public Server Name');
  });

  test('AdvancedSettings shows file pickers', () => {
    const server = { id: 'srv-1' } as any;
    const { lastFrame } = renderWithProviders(<AdvancedSettings server={server} />);
    expect(lastFrame()).toContain('Select SandboxVars.lua');
  });

  test('AdvancedSettings calls sftp upload when file is selected', async () => {
    const server = { id: 'srv-1', staticIp: '1.2.3.4', sshPrivateKey: 'key' } as any;
    renderWithProviders(<AdvancedSettings server={server} />);
    
    expect(lastOnSelect).toBeDefined();
    
    // Simulate selection
    await lastOnSelect('/path/to/SandboxVars.lua');
    
    expect(sftpMock.upload).toHaveBeenCalledWith(
      expect.objectContaining({ host: '1.2.3.4' }),
      '/path/to/SandboxVars.lua',
      '/opt/zomboid/config/SandboxVars.lua'
    );
  });

  test('AdminSettings shows RCON password', () => {
    const server = { id: 'srv-1', rconPassword: 'secret-rcon' } as any;
    const { lastFrame } = renderWithProviders(<AdminSettings server={server} />);
    expect(lastFrame()).toContain('secret-rcon');
  });

  test('SchedulerPanel lists tasks and can create', async () => {
    const server = { id: 'srv-1', staticIp: '1.2.3.4' } as any;
    const { lastFrame } = renderWithProviders(<SchedulerPanel server={server} />);
    
    await new Promise((r) => setTimeout(r, 20));
    
    const frame = lastFrame();
    expect(frame).toContain('auto_backup');
    expect(frame).toContain('0 4 * * *');
  });

  test('SchedulerPanel can create a task', async () => {
    const server = { id: 'srv-1', staticIp: '1.2.3.4' } as any;
    let result: any;
    await act(async () => {
      result = renderWithProviders(<SchedulerPanel server={server} />);
    });
    const { lastFrame, stdin } = result;
    
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100)); // wait for list
    });
    
    // Select 'Create New Task'
    await act(async () => {
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 100));
    });
    
    expect(lastFrame()).toContain('Create Scheduled Task');
    
    // Select broadcast type (third option in type SelectList)
    await act(async () => {
      stdin.write('\x1B[B');
      await new Promise((r) => setTimeout(r, 10));
      stdin.write('\x1B[B');
      await new Promise((r) => setTimeout(r, 10));
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 20));
    });

    // Tab to Cron field
    await act(async () => {
      stdin.write('\t');
      await new Promise((r) => setTimeout(r, 20));
    });

    // Type cron
    await act(async () => {
      stdin.write('0 0 * * *'); // No \r here, just typing
      await new Promise((r) => setTimeout(r, 50));
    });

    // Tab to Broadcast Message field
    await act(async () => {
      stdin.write('\t');
      await new Promise((r) => setTimeout(r, 20));
    });

    // Type message
    await act(async () => {
      stdin.write('Hello');
      await new Promise((r) => setTimeout(r, 50));
    });

    // Tab to Save/Cancel SelectList
    await act(async () => {
      stdin.write('\t');
      await new Promise((r) => setTimeout(r, 20));
    });

    // Select 'Save Task' (first option)
    await act(async () => {
      stdin.write('\r');
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(schedulerMock.addTask).toHaveBeenCalled();
  });


  test('BackupsPanel lists backups and can restore', async () => {
    const server = { id: 'srv-1', name: 's1' } as any;
    const { lastFrame, stdin } = renderWithProviders(<BackupsPanel server={server} />);
    
    await new Promise((r) => setTimeout(r, 100));
    
    const frame = lastFrame();
    expect(frame).toContain('backup1.tar.gz');
    expect(frame).toContain('Restore'); 
  });
});
