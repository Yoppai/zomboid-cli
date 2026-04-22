import React from 'react';
import { Box, Text } from 'ink';

// ── Color thresholds ──

function latencyColor(ms: number): string {
  if (!isFinite(ms)) return 'red';
  if (ms < 100) return 'green';
  if (ms < 200) return 'yellow';
  return 'red';
}

// ── Bar visualization ──

function latencyBarChars(ms: number, maxWidth: number = 20): string {
  if (!isFinite(ms)) return '';
  const clamped = Math.min(ms, 500);
  const filled = Math.max(1, Math.round((clamped / 500) * maxWidth));
  return '█'.repeat(filled);
}

// ── Props ──

export interface LatencyBarProps {
  readonly region: string;
  readonly latencyMs: number;
}

// ── Component ──

export function LatencyBar({ region, latencyMs }: LatencyBarProps) {
  const color = latencyColor(latencyMs);
  const bar = latencyBarChars(latencyMs);
  const label = isFinite(latencyMs) ? `${latencyMs}ms` : 'timeout';

  return React.createElement(
    Box,
    { gap: 1 },
    React.createElement(
      Text,
      { dimColor: !isFinite(latencyMs) },
      region.padEnd(24),
    ),
    bar.length > 0
      ? React.createElement(Text, { color }, bar)
      : null,
    React.createElement(
      Text,
      { color, bold: true },
      label,
    ),
  );
}
