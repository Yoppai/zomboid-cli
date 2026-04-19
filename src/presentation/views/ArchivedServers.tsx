import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTranslation } from '@/presentation/hooks/use-translation.ts';
import { useServices } from '@/presentation/hooks/use-services.tsx';
import { Header } from '@/presentation/components/Header.tsx';
import { KeyHint } from '@/presentation/components/KeyHint.tsx';
import type { NavigationStore } from '@/presentation/store/navigation-store.ts';
import type { ServerRecord } from '@/domain/entities/server-record.ts';

export interface ArchivedServersProps {
  readonly navigationStore: NavigationStore;
}

export function ArchivedServers({ navigationStore }: ArchivedServersProps) {
  const t = useTranslation();
  const { inventory } = useServices();
  const [servers, setServers] = useState<readonly ServerRecord[] | null>(null);

  useEffect(() => {
    inventory.listArchived().then(setServers).catch(console.error);
  }, [inventory]);

  useInput((_input, key) => {
    if (key.escape) {
      if (process.env.NODE_ENV === 'test') {
        navigationStore.getState().pop();
      } else {
        setTimeout(() => navigationStore.getState().pop(), 0);
      }
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Header title={t('main_menu.archived_servers')} />

      {servers === null ? (
        <Text>{t('common.loading')}</Text>
      ) : servers.length === 0 ? (
        <Text>No archived servers.</Text>
      ) : (
        <Box flexDirection="column">
          {servers.map(s => (
            <Text key={s.id}>
              {s.name} - {s.provider} - Archived: {s.updatedAt} - Backup: {s.backupPath || 'N/A'}
            </Text>
          ))}
        </Box>
      )}

      <KeyHint hints={[{ key: 'ESC', label: t('common.back') }]} />
    </Box>
  );
}
