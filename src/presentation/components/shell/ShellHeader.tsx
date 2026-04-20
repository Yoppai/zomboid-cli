import React from 'react';
import { Box, Text } from 'ink';

export interface ShellHeaderProps {
  readonly version: string;
  readonly activeCount: number;
  readonly totalCount: number;
}

export function ShellHeader({ version, activeCount, totalCount }: ShellHeaderProps) {
  return (
    <Box flexDirection="column" gap={0}>
      {/* System Status bar — single-line horizontal strip, no box border */}
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        paddingX={2}
        paddingY={0}
      >
        {/* Left: status label */}
        <Box gap={1} alignItems="center">
          <Text bold color="cyan">[</Text>
          <Text bold color="white">System Status</Text>
          <Text bold color="cyan">]</Text>
          <Text dimColor>|</Text>
          <Text dimColor>Active:</Text>
          <Text bold color="green">{activeCount}</Text>
          <Text dimColor>/</Text>
          <Text>{totalCount}</Text>
          <Text dimColor>|</Text>
          {activeCount === 0 && (
            <Text dimColor italic>No active servers</Text>
          )}
        </Box>

        {/* Right: version */}
        <Box gap={1} alignItems="center">
          <Text dimColor>[</Text>
          <Text italic dimColor>CLI v{version}</Text>
          <Text dimColor>]</Text>
        </Box>
      </Box>

      {/* Bottom separator — consistent double border */}
      <Box borderStyle="double" borderColor="cyan" marginY={0} />
    </Box>
  );
}