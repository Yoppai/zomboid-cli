import React from 'react';
import { Box, Text } from 'ink';
import { useWindowSize } from 'ink';
import { useTranslation } from '@/presentation/hooks/use-translation.ts';
import { useSyncExternalStore } from 'react';
import type { createServerStore } from '@/presentation/store/server-store.ts';
import type { createNavigationStore } from '@/presentation/store/navigation-store.ts';

// Threshold for PLAYERS column collapse (narrow terminal)
// PLAYERS collapses first at NARROW_THRESHOLD (80)
// PROFILE collapses later at VERY_NARROW_THRESHOLD (60)
const NARROW_THRESHOLD = 80;
const VERY_NARROW_THRESHOLD = 60;

export interface ArchivedServersPanelProps {
  readonly serverStore: ReturnType<typeof createServerStore>;
  readonly navStore: ReturnType<typeof createNavigationStore>;
}

export function ArchivedServersPanel({ serverStore, navStore }: ArchivedServersPanelProps) {
  const t = useTranslation();
  const { columns } = useWindowSize();

  const isNarrow = columns < NARROW_THRESHOLD;
  const isVeryNarrow = columns < VERY_NARROW_THRESHOLD;

  // Subscribe to focusRegion from navStore
  const focusRegion = useSyncExternalStore(
    (cb) => navStore.subscribe(cb),
    () => navStore.getState().focusRegion,
  );
  const isFocused = focusRegion === 'main';

  // Subscribe to archived list from serverStore (hydrated on mount)
  const archivedServers = useSyncExternalStore(
    (cb) => serverStore.subscribe(cb),
    () => serverStore.getState().archived,
  );

  if (archivedServers.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>{t('archived.no_servers')}</Text>
        <Text dimColor italic>{t('archived.create_hint')}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={0}>
      {/* Column header — consistent with ActiveServersPanel */}
      <Box
        flexDirection="row"
        gap={isNarrow ? 1 : 2}
        paddingX={0}
        marginBottom={0}
      >
        <Text dimColor>{'─'.repeat(13)}</Text>
        <Text dimColor>{'─'.repeat(12)}</Text>
        {!isVeryNarrow && <Text dimColor>{'─'.repeat(11)}</Text>}
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
        <Text bold dimColor>ACTION</Text>
      </Box>

      {/* Archived server rows — read-only table */}
      {archivedServers.map((server) => {
        const name = server.name.padEnd(12).slice(0, 12);
        const profile = isVeryNarrow ? '' : server.gameBranch.padEnd(10).slice(0, 10);
        const statusStr = 'archived';

        return (
          <Box
            key={server.id}
            flexDirection="row"
            gap={isNarrow ? 1 : 2}
            paddingX={0}
          >
            <Text dimColor={!isFocused}>{name}</Text>
            <Text dimColor={!isFocused} color="cyan">{statusStr}</Text>
            {!isVeryNarrow && <Text dimColor={!isFocused}>{profile}</Text>}
            <Text dimColor={!isFocused}>[Restore]</Text>
          </Box>
        );
      })}
    </Box>
  );
}
