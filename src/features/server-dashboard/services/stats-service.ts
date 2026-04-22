import type { ISshGateway } from '@/shared/infra/contracts/i-ssh-gateway.ts';
import type { SshConnectionConfig, ContainerStats } from '@/shared/infra/entities/value-objects.ts';

// ── Container name constant ──

const CONTAINER_NAME = 'zomboid-server';

// ── StatsService ──

export class StatsService {
  constructor(private readonly ssh: ISshGateway) {}

  /**
   * Fetch container metrics snapshot via `docker stats --no-stream`.
   * Parses the JSON response into a structured ContainerStats object.
   * Throws if the container is not running (empty response).
   */
  async getContainerStats(conn: SshConnectionConfig): Promise<ContainerStats> {
    const result = await this.ssh.exec(
      conn,
      "docker stats --no-stream --format '{{json .}}'",
    );

    const stdout = result.stdout.trim();
    if (!stdout) {
      throw new Error('Container not running — no stats available');
    }

    return parseDockerStats(stdout);
  }

  /**
   * Fetch the last N lines of container logs.
   * Returns an array of log lines (empty array if no output).
   */
  async getRecentLogs(
    conn: SshConnectionConfig,
    lines: number = 100,
  ): Promise<string[]> {
    const result = await this.ssh.exec(
      conn,
      `docker logs --tail ${lines} ${CONTAINER_NAME} 2>&1`,
    );

    const stdout = result.stdout.trim();
    if (!stdout) {
      return [];
    }

    return stdout.split('\n');
  }

  async getLogSnapshot(conn: SshConnectionConfig, lines: number = 100): Promise<string> {
    return (await this.getRecentLogs(conn, lines)).join('\n');
  }

  /**
   * Stream container logs in real-time via `docker logs -f`.
   * Calls onLine for each new line. AbortSignal cancels the stream.
   */
  async streamLogs(
    conn: SshConnectionConfig,
    onLine: (line: string) => void,
    signal: AbortSignal,
  ): Promise<void> {
    await this.ssh.execStream(
      conn,
      `docker logs -f ${CONTAINER_NAME} 2>&1`,
      onLine,
      signal,
    );
  }
}

// ── Pure function: parse docker stats JSON ──

export function parseDockerStats(json: string): ContainerStats {
  const raw = JSON.parse(json);
  return {
    cpuPercent: raw.CPUPerc,
    memUsage: raw.MemUsage,
    memPercent: raw.MemPerc,
    netIO: raw.NetIO,
    blockIO: raw.BlockIO,
    pids: parseInt(raw.PIDs, 10),
  };
}
