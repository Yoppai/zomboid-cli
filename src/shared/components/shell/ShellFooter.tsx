import React from 'react';
import { Box, Text, useWindowSize } from 'ink';

export interface ShellFooterProps {
  readonly hints?: readonly string[];
}

// Normal terminal: show all 4 badges inline
// Narrow terminal (< 90 cols): collapse to 2 rows
const NARROW_THRESHOLD = 90;

/**
 * ShellFooter — keyboard hints bar pinned at bottom of shell.
 *
 * Normal terminal (>= 90 cols): navigation badges on left, quit on right.
 * Narrow terminal (< 90 cols): 2 rows — primary on first, Tab + Quit on second.
 * Custom hints from store render alongside the right-side quit group.
 *
 * No border — badges use white/black keycap styling.
 * Height budget contribution: 1-2 rows depending on breakpoint.
 */
export function ShellFooter({ hints = [] }: ShellFooterProps) {
  const { columns } = useWindowSize();
  const isNarrow = columns < NARROW_THRESHOLD;

  return (
    <Box
      flexDirection="column"
      justifyContent="center"
      paddingX={2}
      paddingY={0}
      gap={0}
    >
      {/* Primary row — badges spread across full width (space-between) */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        gap={isNarrow ? 2 : 3}
      >
        {/* Left: core navigation badges */}
        <Box flexDirection="row" gap={isNarrow ? 2 : 3}>
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

        {/* Right: custom hints + quit */}
        <Box flexDirection="row" gap={1} alignItems="center">
          {hints.map((hint, i) => (
            <Text key={i} dimColor italic>{hint}</Text>
          ))}
          {!isNarrow && <KeyBadge keys="Q" label="Quit" />}
        </Box>
      </Box>

      {/* Secondary row on narrow terminals */}
      {isNarrow && (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={2}>
          <KeyBadge keys="Tab" label="Switch" />
          <KeyBadge keys="Q" label="Quit" />
        </Box>
      )}
    </Box>
  );
}

// Key badge: white/black keycap style
function KeyBadge({ keys, label }: { keys: string; label: string }) {
  return (
    <Box gap={0} alignItems="center">
      <Text backgroundColor="white" color="black" bold>{`[${keys}]`}</Text>
      <Text dimColor> </Text>
      <Text dimColor>{label}</Text>
    </Box>
  );
}
