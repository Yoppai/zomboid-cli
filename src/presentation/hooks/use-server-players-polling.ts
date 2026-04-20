import { useEffect, useRef } from 'react';
import { useServices } from './use-services.tsx';
import type { ServerRecord } from '@/domain/entities/server-record.ts';

/**
 * Hybrid polling hook for player count.
 * Active ONLY when:
 * - Tab is visible (caller controls isActive)
 * - Server is in 'running' state
 *
 * Uses invalidationToken from serverStore to trigger re-fetch
 * when server list mutations occur (deploy, stop, start).
 */
export function useServerPlayersPolling(
  server: ServerRecord | null,
  isActive: boolean,
  onPlayers: (count: number) => void,
  intervalMs = 10_000,
) {
  const { rcon } = useServices();
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
      if (!server.staticIp || !server.rconPassword) return;
      try {
        const players = await rcon?.getOnlinePlayers?.(server.staticIp, server.rconPassword);
        onPlayers(players?.length ?? 0);
      } catch {
        // Non-fatal — server might be starting up
      }
    };

    // Initial fetch immediately
    poll();

    // Then poll at interval
    timerRef.current = setTimeout(poll, intervalMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive, server?.id, server?.status, intervalMs, rcon, onPlayers, server]);
}
