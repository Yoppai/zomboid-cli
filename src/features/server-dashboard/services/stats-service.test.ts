import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { ISshGateway, CommandResult } from '@/shared/infra/contracts/i-ssh-gateway.ts';
import type { SshConnectionConfig, ContainerStats } from '@/shared/infra/entities/value-objects.ts';

// Production code that does NOT exist yet — guarantees RED
import { StatsService } from '@/features/server-dashboard/services/stats-service';

// ── Helpers ──

const TEST_CONN: SshConnectionConfig = {
  host: '34.120.5.1',
  port: 22,
  username: 'root',
  privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
};

function cmd(stdout: string, exitCode = 0): CommandResult {
  return { stdout, stderr: '', exitCode };
}

function createMockSsh(overrides: Partial<ISshGateway> = {}): ISshGateway {
  return {
    exec: mock(async () => cmd('')),
    execStream: mock(async () => {}),
    createTunnel: mock(async () => ({ close: mock(() => {}) })),
    testConnection: mock(async () => true),
    disconnect: mock(async () => {}),
    disconnectAll: mock(async () => {}),
    ...overrides,
  };
}

// ── docker stats JSON output (matches `docker stats --no-stream --format '{{json .}}'`) ──

const DOCKER_STATS_JSON = JSON.stringify({
  CPUPerc: '45.20%',
  MemUsage: '2.1GiB / 6.0GiB',
  MemPerc: '35.00%',
  NetIO: '1.2MB / 3.4MB',
  BlockIO: '500kB / 1.2MB',
  PIDs: '42',
});

const DOCKER_STATS_JSON_2 = JSON.stringify({
  CPUPerc: '0.05%',
  MemUsage: '128MiB / 8.0GiB',
  MemPerc: '1.56%',
  NetIO: '100kB / 200kB',
  BlockIO: '0B / 0B',
  PIDs: '3',
});

// ── Tests ──

describe('StatsService', () => {
  let ssh: ISshGateway;
  let svc: StatsService;

  beforeEach(() => {
    ssh = createMockSsh();
    svc = new StatsService(ssh);
  });

  // ── getContainerStats ──

  describe('getContainerStats', () => {
    it('should execute docker stats command via SSH and parse JSON', async () => {
      ssh = createMockSsh({
        exec: mock(async () => cmd(DOCKER_STATS_JSON)),
      });
      svc = new StatsService(ssh);

      const stats = await svc.getContainerStats(TEST_CONN);

      expect(stats.cpuPercent).toBe('45.20%');
      expect(stats.memUsage).toBe('2.1GiB / 6.0GiB');
      expect(stats.memPercent).toBe('35.00%');
      expect(stats.netIO).toBe('1.2MB / 3.4MB');
      expect(stats.blockIO).toBe('500kB / 1.2MB');
      expect(stats.pids).toBe(42);
    });

    it('should execute correct docker stats command', async () => {
      ssh = createMockSsh({
        exec: mock(async (_conn, command) => {
          expect(command).toBe(
            "docker stats --no-stream --format '{{json .}}'",
          );
          return cmd(DOCKER_STATS_JSON);
        }),
      });
      svc = new StatsService(ssh);

      await svc.getContainerStats(TEST_CONN);

      expect(ssh.exec).toHaveBeenCalledTimes(1);
    });

    it('should parse different stat values correctly (triangulate)', async () => {
      ssh = createMockSsh({
        exec: mock(async () => cmd(DOCKER_STATS_JSON_2)),
      });
      svc = new StatsService(ssh);

      const stats = await svc.getContainerStats(TEST_CONN);

      expect(stats.cpuPercent).toBe('0.05%');
      expect(stats.memUsage).toBe('128MiB / 8.0GiB');
      expect(stats.memPercent).toBe('1.56%');
      expect(stats.netIO).toBe('100kB / 200kB');
      expect(stats.blockIO).toBe('0B / 0B');
      expect(stats.pids).toBe(3);
    });

    it('should throw on empty response (container not running)', async () => {
      ssh = createMockSsh({
        exec: mock(async () => cmd('')),
      });
      svc = new StatsService(ssh);

      await expect(svc.getContainerStats(TEST_CONN)).rejects.toThrow(
        /not running/i,
      );
    });

    it('should pass connection config to ssh.exec', async () => {
      ssh = createMockSsh({
        exec: mock(async (conn) => {
          expect(conn.host).toBe('34.120.5.1');
          expect(conn.port).toBe(22);
          return cmd(DOCKER_STATS_JSON);
        }),
      });
      svc = new StatsService(ssh);

      await svc.getContainerStats(TEST_CONN);
    });
  });

  // ── getRecentLogs ──

  describe('getRecentLogs', () => {
    it('should execute docker logs with default 100 lines', async () => {
      const logOutput = 'line1\nline2\nline3';
      ssh = createMockSsh({
        exec: mock(async (_conn, command) => {
          expect(command).toBe('docker logs --tail 100 zomboid-server 2>&1');
          return cmd(logOutput);
        }),
      });
      svc = new StatsService(ssh);

      const lines = await svc.getRecentLogs(TEST_CONN);

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('line1');
      expect(lines[1]).toBe('line2');
      expect(lines[2]).toBe('line3');
    });

    it('should use custom line count when specified', async () => {
      ssh = createMockSsh({
        exec: mock(async (_conn, command) => {
          expect(command).toBe('docker logs --tail 500 zomboid-server 2>&1');
          return cmd('custom-line');
        }),
      });
      svc = new StatsService(ssh);

      const lines = await svc.getRecentLogs(TEST_CONN, 500);

      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('custom-line');
    });

    it('should return empty array on empty output', async () => {
      ssh = createMockSsh({
        exec: mock(async () => cmd('')),
      });
      svc = new StatsService(ssh);

      const lines = await svc.getRecentLogs(TEST_CONN);
      expect(lines).toEqual([]);
    });
  });

  // ── streamLogs ──

  describe('streamLogs', () => {
    it('should use execStream with docker logs -f command', async () => {
      const controller = new AbortController();
      ssh = createMockSsh({
        execStream: mock(async (_conn, command, _onLine, _signal) => {
          expect(command).toBe('docker logs -f zomboid-server 2>&1');
        }),
      });
      svc = new StatsService(ssh);

      await svc.streamLogs(TEST_CONN, () => {}, controller.signal);

      expect(ssh.execStream).toHaveBeenCalledTimes(1);
    });

    it('should pass each line to the onLine callback', async () => {
      const receivedLines: string[] = [];
      const controller = new AbortController();

      ssh = createMockSsh({
        execStream: mock(async (_conn, _command, onData, _signal) => {
          // Simulate lines arriving
          onData('Log entry 1');
          onData('Log entry 2');
          onData('Log entry 3');
        }),
      });
      svc = new StatsService(ssh);

      await svc.streamLogs(
        TEST_CONN,
        (line) => receivedLines.push(line),
        controller.signal,
      );

      expect(receivedLines).toEqual([
        'Log entry 1',
        'Log entry 2',
        'Log entry 3',
      ]);
    });

    it('should pass the AbortSignal to execStream', async () => {
      const controller = new AbortController();
      let capturedSignal: AbortSignal | undefined;

      ssh = createMockSsh({
        execStream: mock(async (_conn, _command, _onData, signal) => {
          capturedSignal = signal;
        }),
      });
      svc = new StatsService(ssh);

      await svc.streamLogs(TEST_CONN, () => {}, controller.signal);

      expect(capturedSignal).toBe(controller.signal);
    });

    it('should pass connection config to execStream', async () => {
      const controller = new AbortController();

      ssh = createMockSsh({
        execStream: mock(async (conn) => {
          expect(conn.host).toBe('34.120.5.1');
        }),
      });
      svc = new StatsService(ssh);

      await svc.streamLogs(TEST_CONN, () => {}, controller.signal);
    });
  });
});
