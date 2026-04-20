import React from 'react';
import { Box, Text } from 'ink';

export interface ShellFrameProps {
  readonly children: React.ReactNode;
}

export function ShellFrame({ children }: ShellFrameProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Title — double-line framed box, consistent with content frame grammar */}
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingY={0}
        borderStyle="double"
        borderColor="cyan"
      >
        <Text bold color="cyan"> ZOMBOID-CLI </Text>
      </Box>
      {/* Content */}
      {children}
    </Box>
  );
}
