import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStats } from '@/presentation/hooks/use-stats.ts';
import { LogViewer } from '@/presentation/components/LogViewer.tsx';
import { SelectList } from '@/presentation/components/SelectList.tsx';
import type { ServerRecord } from '@/domain/entities/server-record.ts';
import type { SshConnectionConfig } from '@/domain/entities/value-objects.ts';

export interface ServerStatsProps {
  readonly server: ServerRecord;
}

export function ServerStats({ server }: ServerStatsProps) {
  const { containerStats, logs, fetchStats, fetchLogs } = useStats();
  const [mode, setMode] = useState<'stats' | 'logs'>('stats');

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
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Server Statistics</Text>
      
      <Box flexDirection="column" borderStyle="single" padding={1}>
        {containerStats ? (
          <>
            <Text>CPU Usage: {containerStats.cpuPercent}</Text>
            <Text>Memory: {containerStats.memUsage} ({containerStats.memPercent})</Text>
            <Text>Network I/O: {containerStats.netIO}</Text>
            <Text>Block I/O: {containerStats.blockIO}</Text>
            <Text>PIDs: {containerStats.pids}</Text>
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
      />
    </Box>
  );
}
