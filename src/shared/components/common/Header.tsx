import React from 'react';
import { Box, Text } from 'ink';

// ── Props ──

export interface HeaderProps {
  readonly title: string;
  readonly breadcrumb?: readonly string[];
}

// ── Component ──

export function Header({ title, breadcrumb }: HeaderProps) {
  return React.createElement(
    Box,
    { flexDirection: 'column', marginBottom: 1 },
    // Breadcrumb row (if provided)
    breadcrumb && breadcrumb.length > 0
      ? React.createElement(
          Box,
          null,
          React.createElement(
            Text,
            { dimColor: true },
            breadcrumb.join(' › '),
          ),
        )
      : null,
    // Title row
    React.createElement(
      Box,
      null,
      React.createElement(Text, { bold: true, color: 'cyan' }, title),
    ),
  );
}
