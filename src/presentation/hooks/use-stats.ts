import { useState, useCallback, useEffect } from 'react';
import { useServices } from './use-services.tsx';
import type { SshConnectionConfig, ContainerStats } from '@/domain/entities/value-objects.ts';

export function useStats() {
  const { stats } = useServices();
  const [containerStats, setContainerStats] = useState<ContainerStats | null>(null);
  const [logs, setLogs] = useState<string>('');

  const fetchStats = useCallback(async (conn: SshConnectionConfig) => {
    try {
      const data = await stats.getContainerStats(conn);
      setContainerStats(data);
    } catch (e) {
      console.error(e);
    }
  }, [stats]);

  const fetchLogs = useCallback(async (conn: SshConnectionConfig, lines = 100) => {
    try {
      const data = await stats.getLogSnapshot(conn, lines);
      setLogs(data);
    } catch (e) {
      console.error(e);
    }
  }, [stats]);

  return {
    containerStats,
    logs,
    fetchStats,
    fetchLogs,
  };
}
