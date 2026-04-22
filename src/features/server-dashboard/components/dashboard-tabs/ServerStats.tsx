import React, { useEffect, useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStats } from '@/features/server-dashboard/hooks/use-stats';
import { useServerStatsPolling } from '@/features/server-dashboard/hooks/use-server-stats-polling';
import { LogViewer } from '@/shared/components/common/LogViewer.tsx';
import { SelectList } from '@/shared/components/common/SelectList.tsx';
import type { ContainerStats } from '@/shared/infra/entities/value-objects.ts';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { SshConnectionConfig } from '@/shared/infra/entities/value-objects.ts';

export interface ServerStatsProps {
  readonly server: ServerRecord;
  readonly isActive?: boolean;
  readonly focused?: boolean;
}

export function ServerStats({ server, isActive = false, focused = false }: ServerStatsProps) {
  const { containerStats, logs, fetchStats, fetchLogs } = useStats();
  const [mode, setMode] = useState<'stats' | 'logs'>('stats');
  const [polledStats, setPolledStats] = useState<ContainerStats | null>(null);

  useServerStatsPolling(
    server,
    isActive && server.status === 'running',
    useCallback((stats) => setPolledStats(stats), []),
    5_000,
  );

  useEffect(() => {
    if (server.status === 'running' && server.staticIp) {
      const conn: SshConnectionConfig = {
        host: server.staticIp,
        port: 22,
        username: 'zomboid',
        privateKey: server.sshPrivateKey,
      };
      fetchStats(conn);
      fetchLogs(conn, 50);
    }
  }, [server.status, fetchStats, fetchLogs]);

  if (server.status !== 'running') {
    return <Text>Stats are only available when the server is running.</Text>;
  }

  if (mode === 'logs') {
    return (
      <Box flexDirection="column" gap={1}>
        <LogViewer title="Server Logs Snapshot" lines={logs.split('\n')} />
        <SelectList
          items={[{ label: 'Back to Stats', value: 'back' }]}
          onSelect={() => setMode('stats')}
          focused={focused}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Server Statistics</Text>
      
      <Box flexDirection="column" borderStyle="single" padding={1}>
        {(isActive && polledStats ? polledStats : containerStats) ? (
          <>
            <Text>CPU Usage: {(isActive && polledStats ? polledStats : containerStats)?.cpuPercent}</Text>
            <Text>Memory: {(isActive && polledStats ? polledStats : containerStats)?.memUsage} ({(isActive && polledStats ? polledStats : containerStats)?.memPercent})</Text>
            <Text>Network I/O: {(isActive && polledStats ? polledStats : containerStats)?.netIO}</Text>
            <Text>Block I/O: {(isActive && polledStats ? polledStats : containerStats)?.blockIO}</Text>
            <Text>PIDs: {(isActive && polledStats ? polledStats : containerStats)?.pids}</Text>
          </>
        ) : (
          <Text>Fetching stats...</Text>
        )}
      </Box>

      <SelectList
        items={[
          { label: 'Refresh Stats', value: 'refresh' },
          { label: 'View Logs', value: 'logs' },
        ]}
        onSelect={(val) => {
          if (val === 'refresh') {
            fetchStats({
              host: server.staticIp!,
              port: 22,
              username: 'zomboid',
              privateKey: server.sshPrivateKey,
            });
          } else if (val === 'logs') {
            setMode('logs');
          }
        }}
        focused={focused}
      />
    </Box>
  );
}
