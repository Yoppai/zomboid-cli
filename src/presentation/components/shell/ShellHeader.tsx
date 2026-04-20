import React from 'react';
import { Box, Text } from 'ink';
import { TitledBox } from '@mishieck/ink-titled-box';

export interface ShellHeaderProps {
  readonly version: string;
  readonly activeCount: number;
  readonly totalCount: number;
}

/**
 * ShellHeader — single TitledBox with round border and embedded "System Status" title.
 * Contains: CLI version, active servers count, total servers count.
 * No uptime display.
 */
export function ShellHeader({ version, activeCount, totalCount }: ShellHeaderProps) {
  return (
    <TitledBox
      borderStyle="round"
      titles={['System Status']}
    >
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        paddingX={1}
        paddingY={0}
      >
        {/* Left: status label */}
        <Box gap={1} alignItems="center">
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
    </TitledBox>
  );
}
