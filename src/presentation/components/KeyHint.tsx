import React from 'react';
import { Box, Text } from 'ink';

// ── Types ──

export interface HintItem {
  readonly key: string;
  readonly label: string;
}

export interface KeyHintProps {
  readonly hints: readonly HintItem[];
}

// ── Component ──

export function KeyHint({ hints }: KeyHintProps) {
  if (hints.length === 0) {
    return React.createElement(Box, null);
  }

  const children = hints.map((hint, i) => {
    const elements: React.ReactNode[] = [
      React.createElement(Text, { key: `k-${i}`, color: 'yellow', bold: true }, `[${hint.key}]`),
      React.createElement(Text, { key: `l-${i}`, dimColor: true }, ` ${hint.label}`),
    ];
    // Add separator between hints
    if (i < hints.length - 1) {
      elements.push(React.createElement(Text, { key: `s-${i}`, dimColor: true }, '  '));
    }
    return React.createElement(Box, { key: `h-${i}` }, ...elements);
  });

  return React.createElement(
    Box,
    { marginTop: 1 },
    ...children,
  );
}
