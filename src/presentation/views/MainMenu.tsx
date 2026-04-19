import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SelectList } from '@/presentation/components/SelectList.tsx';
import { StatusBadge } from '@/presentation/components/StatusBadge.tsx';
import { useTranslation } from '@/presentation/hooks/use-translation.ts';
import { useServices } from '@/presentation/hooks/use-services.tsx';
import type { NavigationStore } from '@/presentation/store/navigation-store.ts';
import type { ServerRecord } from '@/domain/entities/server-record.ts';

export interface MainMenuProps {
  readonly navigationStore: NavigationStore;
}

export function MainMenu({ navigationStore }: MainMenuProps) {
  const t = useTranslation();
  const { inventory } = useServices();

  const [view, setView] = useState<'menu' | 'servers'>('menu');
  const [servers, setServers] = useState<readonly ServerRecord[] | null>(null);

  useEffect(() => {
    if (view === 'servers') {
      inventory.listActive().then(setServers).catch(console.error);
    }
  }, [view, inventory]);

  // Handle Escape: pop navStore when not at root, or return from sub-views
  useInput((input, key) => {
    if (key.escape) {
      if (view === 'servers') {
        setView('menu');
      } else {
        // Attempt navStore pop — if already at root, navStore ignores the call
        navigationStore.getState().pop();
      }
    }
  });

  const handleMenuSelect = (value: string) => {
    switch (value) {
      case 'create':
        navigationStore.getState().push('setup-wizard');
        break;
      case 'active':
        setView('servers');
        break;
      case 'archived':
        navigationStore.getState().push('archived-servers');
        break;
      case 'settings':
        navigationStore.getState().push('settings');
        break;
    }
  };

  const handleServerSelect = (serverId: string) => {
    if (serverId === 'back') {
      setView('menu');
      return;
    }
    // Server Dashboard not yet fully implemented, but this meets the req
    navigationStore.getState().push('server-dashboard', { serverId });
  };

  if (view === 'servers') {
    if (servers === null) {
      return <Text>{t('common.loading')}</Text>;
    }

    if (servers.length === 0) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text color="cyan" bold>Zomboid CLI - {t('main_menu.active_servers')}</Text>
          <Text>No servers yet.</Text>
          <SelectList
            key="servers-empty"
            items={[{ label: t('common.back'), value: 'back' }]}
            onSelect={handleServerSelect}
          />
        </Box>
      );
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Text color="cyan" bold>Zomboid CLI - {t('main_menu.active_servers')}</Text>
        <SelectList
          key="servers-list"
          items={[
            ...servers.map(s => ({
              label: `${s.name} [${t(`status.${s.status}`)}]`,
              value: s.id,
            })),
            { label: t('common.back'), value: 'back' }
          ]}
          onSelect={handleServerSelect}
        />
      </Box>
    );
  }

  const menuItems = [
    { label: t('main_menu.create_server'), value: 'create' },
    { label: t('main_menu.active_servers'), value: 'active' },
    { label: t('main_menu.archived_servers'), value: 'archived' },
    { label: t('main_menu.global_settings'), value: 'settings' },
  ];

  return (
    <Box flexDirection="column" gap={1} paddingX={2} paddingTop={1}>
      <Text bold color="cyan">{t('main_menu.title')}</Text>
      <SelectList key="main-menu" items={menuItems} onSelect={handleMenuSelect} />
    </Box>
  );
}
