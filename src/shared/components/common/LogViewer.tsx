import React from 'react';
import { Box, Text } from 'ink';

// ── Props ──

export interface LogViewerProps {
  readonly lines: readonly string[];
  readonly title?: string;
}

// ── Component ──

export function LogViewer({ lines, title }: LogViewerProps) {
  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'single', borderColor: 'gray', paddingX: 1 },
    // Title row
    title
      ? React.createElement(Text, { bold: true, color: 'cyan' }, title)
      : null,
    // Log lines or empty state
    lines.length === 0
      ? React.createElement(Text, { dimColor: true }, 'No logs')
      : React.createElement(
          Box,
          { flexDirection: 'column' },
          ...lines.map((line, i) =>
            React.createElement(Text, { key: `log-${i}` }, line),
          ),
        ),
  );
}
