import React from 'react';
import { Box, Text } from 'ink';
import { useWindowSize } from 'ink';
import { useTranslation } from '@/shared/hooks/use-translation.ts';
import { SelectList, type SelectListItem } from '@/shared/components/common/SelectList.tsx';
import { useSyncExternalStore } from 'react';
import type { createServerStore } from '@/features/server-dashboard/model/server-store';
import type { createNavigationStore } from '@/shared/infra/navigation-store.ts';
import type { ServerRecord } from '@/shared/infra/entities/index.ts';

// Threshold for PLAYERS column collapse (narrow terminal)
// PLAYERS collapses first at NARROW_THRESHOLD (80)
// PROFILE collapses later at VERY_NARROW_THRESHOLD (60)
const NARROW_THRESHOLD = 80;
const VERY_NARROW_THRESHOLD = 60;

export interface ActiveServersPanelProps {
  readonly serverStore: ReturnType<typeof createServerStore>;
  readonly navStore: ReturnType<typeof createNavigationStore>;
  readonly onServerSelect: (serverId: string) => void;
}

export function ActiveServersPanel({ serverStore, navStore, onServerSelect }: ActiveServersPanelProps) {
  const t = useTranslation();
  const { columns } = useWindowSize();

  // PLAYERS collapses first (80), PROFILE collapses at very narrow (60)
  const isNarrow = columns < NARROW_THRESHOLD;
  const isVeryNarrow = columns < VERY_NARROW_THRESHOLD;

  // Subscribe to focusRegion from navStore
  const focusRegion = useSyncExternalStore(
    (cb) => navStore.subscribe(cb),
    () => navStore.getState().focusRegion,
  );
  const isFocused = focusRegion === 'main';

  // Zustand subscription for immediate refresh on store mutations
  const servers = useSyncExternalStore(
    (cb) => serverStore.subscribe(cb),
    () => serverStore.getState().active,
  );

  if (servers.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>{t('main_menu.no_servers')}</Text>
        <Text dimColor italic>{t('main_menu.create_server')}</Text>
      </Box>
    );
  }

  // Build SelectList items from server records
  const serverItems: readonly SelectListItem[] = servers.map((server) => ({
    label: server.name,
    value: server.id,
  }));

  // Custom table-row renderer — terminal-style table row
  function renderServerRow(
    item: SelectListItem,
    index: number,
    isSelected: boolean,
    isItemFocused: boolean,
  ): React.ReactNode {
    const server = servers[index];
    if (!server) return null;

    const name = server.name.padEnd(12).slice(0, 12);
    const profile = isVeryNarrow ? '' : server.gameBranch.padEnd(10).slice(0, 10);
    const statusStr = String(server.status).padEnd(12).slice(0, 12);
    const players = isNarrow ? '' : server.status === 'running' ? '1' : '—';
    const action = getPrimaryAction(server.status, t);
    const statusColor = getStatusColor(server.status);

    // Dim non-selected rows when panel has focus
    const dim = isItemFocused ? !isSelected : true;

    // Selected row: full highlight with background block
    if (isSelected && isItemFocused) {
      return (
        <Box
          key={`server-row-${item.value}`}
          flexDirection="row"
          alignItems="center"
          gap={isNarrow ? 1 : 2}
        >
          <Text color="cyan" bold>▌</Text>
          <Text bold color="cyan">{name}</Text>
          <Text bold color={statusColor}>{statusStr}</Text>
          {!isVeryNarrow && <Text dimColor>{profile}</Text>}
          {!isNarrow && <Text dimColor>{players}</Text>}
          <Text bold>{action}</Text>
        </Box>
      );
    }

    // Normal row — status always colored for readability
    return (
      <Box key={`server-row-${item.value}`} gap={isNarrow ? 1 : 2}>
        <Text dimColor={dim}>{name}</Text>
        <Text color={dim ? 'gray' : statusColor} bold={!dim}>{statusStr}</Text>
        {!isVeryNarrow && <Text dimColor={dim}>{profile}</Text>}
        {!isNarrow && <Text dimColor={dim}>{players}</Text>}
        <Text dimColor={dim}>{action}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={0}>
      {/* Column header — consistent borderStyle="single" top rule, then labels */}
      <Box
        flexDirection="row"
        gap={isNarrow ? 1 : 2}
        paddingX={0}
        marginBottom={0}
      >
        <Text dimColor>{'─'.repeat(13)}</Text>
        <Text dimColor>{'─'.repeat(12)}</Text>
        {!isVeryNarrow && <Text dimColor>{'─'.repeat(11)}</Text>}
        {!isNarrow && <Text dimColor>{'─'.repeat(7)}</Text>}
        <Text dimColor>{'─'.repeat(13)}</Text>
      </Box>
      <Box
        flexDirection="row"
        gap={isNarrow ? 1 : 2}
        paddingX={0}
        marginBottom={0}
      >
        <Text bold dimColor>NAME</Text>
        <Text bold dimColor>STATUS</Text>
        {!isVeryNarrow && <Text bold dimColor>PROFILE</Text>}
        {!isNarrow && <Text bold dimColor>PLAYERS</Text>}
        <Text bold dimColor>ACTION</Text>
      </Box>

      {/* Server list — terminal table rows */}
      <SelectList
        items={serverItems}
        onSelect={onServerSelect}
        focused={isFocused}
        renderItem={renderServerRow}
      />
    </Box>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return 'green';
    case 'provisioning': return 'yellow';
    case 'stopped': return 'gray';
    case 'failed': return 'red';
    case 'archived': return 'cyan';
    default: return 'white';
  }
}

function getPrimaryAction(status: string, t: ReturnType<typeof useTranslation>): string {
  switch (status) {
    case 'provisioning': return '[Cancel]';
    case 'running': return '[Stop]';
    case 'stopped': return '[Start]';
    case 'failed': return '[Recover]';
    case 'archived': return '[Restore]';
    default: return '';
  }
}
