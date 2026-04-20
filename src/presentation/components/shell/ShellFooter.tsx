import React from 'react';
import { Box, Text, useWindowSize } from 'ink';

export interface ShellFooterProps {
  readonly hints?: readonly string[];
}

// Normal terminal: show all 4 badges inline
// Narrow terminal (< 90 cols): collapse to 2 rows
const NARROW_THRESHOLD = 90;

export function ShellFooter({ hints = [] }: ShellFooterProps) {
  const { columns } = useWindowSize();
  const isNarrow = columns < NARROW_THRESHOLD;

  return (
    <Box
      flexDirection="column"
      justifyContent="center"
      paddingX={2}
      paddingY={0}
      borderStyle="double"
      borderColor="cyan"
      gap={0}
    >
      {/* Primary hints — always visible */}
      <Box
        flexDirection="row"
        justifyContent="flex-start"
        alignItems="center"
        gap={isNarrow ? 2 : 3}
      >
        <KeyBadge keys="↑↓" label="Move" />
        <KeyBadge keys="Enter" label="Select" />
        {columns >= NARROW_THRESHOLD && (
          <>
            <KeyBadge keys="Esc" label="Back" />
            <KeyBadge keys="Tab" label="Switch" />
          </>
        )}
        {columns < NARROW_THRESHOLD && (
          <KeyBadge keys="Esc" label="Back" />
        )}
      </Box>

      {/* Secondary hints (Tab) on narrow — below primary */}
      {isNarrow && (
        <Box flexDirection="row" alignItems="center" gap={2}>
          <KeyBadge keys="Tab" label="Switch" />
        </Box>
      )}

      {/* Right — custom hints from store */}
      {hints.length > 0 && (
        <Box gap={1} alignItems="center">
          {hints.map((hint, i) => (
            <Text key={i} dimColor italic>{hint}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Key badge: [KEY] label in compact terminal style
function KeyBadge({ keys, label }: { keys: string; label: string }) {
  return (
    <Box gap={0} alignItems="center">
      <Text dimColor>[</Text>
      <Text bold color="cyan">{keys}</Text>
      <Text dimColor>]</Text>
      <Text dimColor> </Text>
      <Text dimColor>{label}</Text>
    </Box>
  );
}
