import React from 'react';
import { Box, Text, useWindowSize } from 'ink';
import { TitledBox } from '@mishieck/ink-titled-box';
import { useTranslation } from '@/presentation/hooks/use-translation.ts';
import { SelectList } from '@/presentation/components/SelectList.tsx';
import type { ShellContext, FocusRegion } from '@/presentation/store/navigation-store.ts';
import { getShellBreakpoint } from '@/presentation/store/navigation-store.ts';

export interface SidebarNavProps {
  readonly context: ShellContext;
  readonly focusRegion: FocusRegion;
  readonly onSelect: (key: string) => void;
  readonly onServerSelect: (tab: string) => void;
}

// Correct i18n keys matching locale files
const MAIN_MENU_ITEMS = [
  { labelKey: 'main_menu.create_server', value: 'create_server' },
  { labelKey: 'main_menu.active_servers', value: 'active-servers' },
  { labelKey: 'main_menu.archived_servers', value: 'archived' },
  { labelKey: 'main_menu.global_settings', value: 'global-settings' },
];

const SERVER_CONFIG_ITEMS = [
  { labelKey: 'main.management', value: 'management' },
  { labelKey: 'main.build', value: 'build' },
  { labelKey: 'main.players', value: 'players' },
  { labelKey: 'main.stats', value: 'stats' },
  { labelKey: 'main.basic', value: 'basic' },
  { labelKey: 'main.advanced', value: 'advanced' },
  { labelKey: 'main.admins', value: 'admins' },
  { labelKey: 'main.scheduler', value: 'scheduler' },
  { labelKey: 'main.backups', value: 'backups' },
];

function getItemLabel(t: ReturnType<typeof useTranslation>, labelKey: string, fallback: string): string {
  const translated = t(labelKey);
  return translated === labelKey ? fallback : translated;
}

// Numbered item renderer with full-width highlight bar for selected item
function numberedRenderItem(
  item: { label: string; value: string; disabled?: boolean },
  index: number,
  isSelected: boolean,
  isFocused: boolean,
): React.ReactNode {
  const num = String(index + 1).padStart(2, ' ');
  const indicator = isSelected ? '▌' : ' ';

  // Selected item: full cyan bar with white text for maximum contrast
  if (isSelected && isFocused) {
    return (
      <Box
        key={`nav-${item.value}`}
        flexDirection="row"
        alignItems="center"
        gap={0}
        paddingX={1}
      >
        <Text color="cyan" bold>{indicator}</Text>
        <Text bold color="white" backgroundColor="cyan"> {num}. {item.label} </Text>
      </Box>
    );
  }

  // Unfocused — dim all
  if (!isFocused) {
    return (
      <Box key={`nav-${item.value}`} gap={0} paddingX={1}>
        <Text dimColor>{num}.</Text>
        <Text dimColor> </Text>
        <Text dimColor>{item.label}</Text>
      </Box>
    );
  }

  // Focused but not selected
  return (
    <Box key={`nav-${item.value}`} gap={0} paddingX={1}>
      <Text dimColor={false}>{num}.</Text>
      <Text dimColor={false}> </Text>
      <Text color="white">{item.label}</Text>
    </Box>
  );
}

export function SidebarNav({ context, focusRegion, onSelect, onServerSelect }: SidebarNavProps) {
  const t = useTranslation();
  const { columns } = useWindowSize();

  const isMain = context.kind === 'main';
  const titleKey = isMain ? 'sidebar.main_menu' : 'sidebar.server_config';
  const isFocused = focusRegion === 'sidebar';

  const bp = getShellBreakpoint(columns);

  // Responsive width strategy:
  // - wide  (>=120): ~35% of columns, clamped 30-50
  // - default (90-119): fixed 30
  // - narrow (<90): compact 20
  const sidebarWidth = (() => {
    if (bp === 'wide') {
      const raw = Math.floor(columns * 0.35);
      return Math.max(30, Math.min(50, raw));
    }
    if (bp === 'narrow') return 20;
    return 30; // default
  })();

  const items = isMain
    ? MAIN_MENU_ITEMS.map((item) => ({
        label: getItemLabel(t, item.labelKey, item.value),
        value: item.value,
      }))
    : SERVER_CONFIG_ITEMS.map((item) => ({
        label: getItemLabel(t, item.labelKey, item.value),
        value: item.value,
      }));

  function handleSelect(value: string) {
    if (isMain) {
      onSelect(value);
    } else {
      onServerSelect(value);
    }
  }

  return (
    <TitledBox
      borderStyle="round"
      titles={[t(titleKey)]}
      width={sidebarWidth}
    >
      {/* Numbered item list with keyboard selection */}
      <SelectList
        items={items.map((item) => ({ label: item.label, value: item.value }))}
        onSelect={handleSelect}
        focused={isFocused}
        renderItem={numberedRenderItem as any}
      />
    </TitledBox>
  );
}
