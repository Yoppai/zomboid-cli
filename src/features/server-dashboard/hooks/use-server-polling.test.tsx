import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import React from 'react';
import { act } from 'react';
import { render } from 'ink-testing-library';
import { useServerPlayersPolling } from '@/features/server-dashboard/hooks/use-server-players-polling';
import { useServerStatsPolling } from '@/features/server-dashboard/hooks/use-server-stats-polling';
import { ServiceProvider } from '@/shared/hooks/use-services.tsx';

function createMockServices() {
  return {
    inventory: { listActive: async () => [], listArchived: async () => [], getServer: async () => null },
    cloudProvider: { verifyAuth: async () => true },
    latency: { measureAllRegions: async () => [] },
    deploy: { deploy: async () => ({}), startServer: async () => {}, stopServer: async () => {} },
    rcon: { getOnlinePlayers: async () => [{ username: 'Player1' }, { username: 'Player2' }] },
    stats: { getContainerStats: async () => ({ cpuPercent: '10%', memUsage: '1GB', memPercent: '50%', netIO: '100MB', blockIO: '50MB', pids: 42 }) },
    backup: {},
    updateFlow: {},
    scheduler: {},
    archive: {},
    localDb: { getSetting: async () => 'en', setSetting: async () => {} },
    notificationStore: { addNotification: () => {} },
  };
}

const PlayerPollingTestComponent: React.FC<{
  server: { id: string; status: string; staticIp: string; rconPassword: string };
  isActive: boolean;
  onPlayers: (n: number) => void;
}> = ({ server, isActive, onPlayers }) => {
  useServerPlayersPolling(server as any, isActive, onPlayers, 5_000);
  return null;
};

const StatsPollingTestComponent: React.FC<{
  server: { id: string; status: string; staticIp: string; sshPrivateKey: string };
  isActive: boolean;
  onStats: (s: any) => void;
}> = ({ server, isActive, onStats }) => {
  useServerStatsPolling(server as any, isActive, onStats, 5_000);
  return null;
};

describe('useServerPlayersPolling', () => {
  let playerCount = -1;

  beforeEach(() => { playerCount = -1; });

  it('does NOT poll when isActive=false', async () => {
    const server = { id: 'srv-1', status: 'running', staticIp: '1.2.3.4', rconPassword: 'pw' };
    render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(PlayerPollingTestComponent, { server, isActive: false, onPlayers: (n) => { playerCount = n; } }),
      ),
    );
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    expect(playerCount).toBe(-1);
  });

  it('polls when isActive=true and server is running', async () => {
    const server = { id: 'srv-1', status: 'running', staticIp: '1.2.3.4', rconPassword: 'pw' };
    render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(PlayerPollingTestComponent, { server, isActive: true, onPlayers: (n) => { playerCount = n; } }),
      ),
    );
    await act(async () => { await new Promise(r => setTimeout(r, 200)); });
    expect(playerCount).toBeGreaterThanOrEqual(0);
  });

  it('does NOT poll when server is NOT running', async () => {
    const server = { id: 'srv-1', status: 'stopped', staticIp: '1.2.3.4', rconPassword: 'pw' };
    render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(PlayerPollingTestComponent, { server, isActive: true, onPlayers: (n) => { playerCount = n; } }),
      ),
    );
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    expect(playerCount).toBe(-1);
  });
});

describe('useServerStatsPolling', () => {
  let latestStats: any = undefined;

  beforeEach(() => { latestStats = undefined; });

  it('does NOT poll when isActive=false', async () => {
    const server = { id: 'srv-1', status: 'running', staticIp: '1.2.3.4', sshPrivateKey: 'key' };
    render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(StatsPollingTestComponent, { server, isActive: false, onStats: (s) => { latestStats = s; } }),
      ),
    );
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    expect(latestStats).toBeUndefined();
  });

  it('polls when isActive=true and server is running', async () => {
    const server = { id: 'srv-1', status: 'running', staticIp: '1.2.3.4', sshPrivateKey: 'key' };
    render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(StatsPollingTestComponent, { server, isActive: true, onStats: (s) => { latestStats = s; } }),
      ),
    );
    await act(async () => { await new Promise(r => setTimeout(r, 200)); });
    expect(latestStats).not.toBeUndefined();
    expect(latestStats?.cpuPercent).toBe('10%');
  });

  it('does NOT poll when server is NOT running', async () => {
    const server = { id: 'srv-1', status: 'stopped', staticIp: '1.2.3.4', sshPrivateKey: 'key' };
    render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(StatsPollingTestComponent, { server, isActive: true, onStats: (s) => { latestStats = s; } }),
      ),
    );
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    expect(latestStats).toBeUndefined();
  });
});
