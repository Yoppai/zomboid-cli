import React from 'react';
import { Box } from 'ink';
import type { Locale } from '@/shared/hooks/use-translation.ts';

// ── Props ──

export interface AppShellProps {
  readonly locale?: Locale;
  readonly children?: React.ReactNode;
}

// ── Component ──

export function AppShell({ children }: AppShellProps) {
  return React.createElement(
    Box,
    { flexDirection: 'column', width: '100%' },
    children,
  );
}
