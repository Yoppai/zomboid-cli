import React from 'react';
import { Box, Text } from 'ink';

// ── Props ──

export interface ProgressBarProps {
  readonly percent: number;
  readonly label?: string;
  readonly width?: number;
}

// ── Component ──

export function ProgressBar({ percent, label, width = 20 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const color = clamped === 100 ? 'green' : clamped >= 50 ? 'yellow' : 'cyan';

  return React.createElement(
    Box,
    { gap: 1 },
    label
      ? React.createElement(Text, null, label)
      : null,
    React.createElement(Text, { color }, bar),
    React.createElement(Text, { bold: true }, `${clamped}%`),
  );
}
