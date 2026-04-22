import { useEffect, useRef } from 'react';
import { useServices } from '@/shared/hooks/use-services.tsx';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';

/**
 * Hybrid polling hook for server stats (CPU, memory, network I/O).
 * Active ONLY when:
 * - Stats tab is visible (caller controls isActive)
 * - Server is in 'running' state
 *
 * Interval: 5s per spec.
 */
export function useServerStatsPolling(
  server: ServerRecord | null,
  isActive: boolean,
  onStats: (stats: ContainerStats | null) => void,
  intervalMs = 5_000,
) {
  const { stats } = useServices();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive || !server || server.status !== 'running') {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      if (!server.staticIp) return;
      try {
        // Build SSH config from server record for stats service
        const conn = {
          host: server.staticIp,
          port: 22,
          username: 'ssh-user',
          privateKey: server.sshPrivateKey,
        };
        const data = await stats.getContainerStats(conn);
        onStats(data);
      } catch {
        // Non-fatal
        onStats(null);
      }
    };

    poll();
    timerRef.current = setTimeout(poll, intervalMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive, server?.id, server?.status, intervalMs, stats, onStats, server]);
}

// Re-export ContainerStats for convenience
import type { ContainerStats } from '@/shared/infra/entities/value-objects.ts';
export type { ContainerStats };
