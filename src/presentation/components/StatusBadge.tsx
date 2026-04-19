import React from 'react';
import { Text } from 'ink';
import type { ServerStatus } from '@/domain/entities/enums.ts';

// ── Color mapping per status ──

const STATUS_COLORS: Record<ServerStatus, string> = {
  running: 'green',
  stopped: 'yellow',
  failed: 'red',
  provisioning: 'blue',
  archived: 'gray',
};

const STATUS_LABELS: Record<ServerStatus, string> = {
  running: 'Running',
  stopped: 'Stopped',
  failed: 'Failed',
  provisioning: 'Provisioning',
  archived: 'Archived',
};

// ── Props ──

export interface StatusBadgeProps {
  readonly status: ServerStatus;
}

// ── Component ──

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return React.createElement(
    Text,
    { color },
    `● ${label}`,
  );
}
