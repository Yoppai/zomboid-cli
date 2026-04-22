import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { SelectList } from '@/shared/components/common/SelectList.tsx';
import { useTranslation } from '@/shared/hooks/use-translation.ts';
import { useServices } from '@/shared/hooks/use-services.tsx';
import type { NavigationStore } from '@/shared/infra/navigation-store.ts';

export interface MainMenuPanelProps {
  readonly navStore: NavigationStore;
}

export function MainMenuPanel({ navStore }: MainMenuPanelProps) {
  const t = useTranslation();
  const { inventory } = useServices();
  const [serverCount, setServerCount] = useState(0);

  React.useEffect(() => {
    inventory.listActive().then((servers) => setServerCount(servers.length)).catch(() => setServerCount(0));
  }, [inventory]);

  const menuItems = [
    { label: t('main_menu.create_server'), value: 'create' },
    { label: `${t('main_menu.active_servers')} (${serverCount})`, value: 'active-servers' },
    { label: t('main_menu.archived_servers'), value: 'archived' },
    { label: t('main_menu.global_settings'), value: 'global-settings' },
  ];

  return (
    <Box flexDirection="column" gap={1} paddingX={2} paddingTop={1}>
      <SelectList key="main-menu" items={menuItems} onSelect={() => {}} />
    </Box>
  );
}
