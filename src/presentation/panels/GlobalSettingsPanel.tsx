import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useTranslation, setRuntimeLocale, type Locale } from '@/presentation/hooks/use-translation.ts';
import { useServices } from '@/presentation/hooks/use-services.tsx';
import { SelectList } from '@/presentation/components/SelectList.tsx';
import type { createNavigationStore } from '@/presentation/store/navigation-store.ts';

export interface GlobalSettingsPanelProps {
  readonly navStore: ReturnType<typeof createNavigationStore>;
  readonly focused?: boolean;
}

export function GlobalSettingsPanel({ navStore, focused = false }: GlobalSettingsPanelProps) {
  const t = useTranslation();
  const { localDb } = useServices();
  const [locale, setLocale] = useState<Locale>('en');
  const [backupPath, setBackupPath] = useState('~/.zomboid-cli/backups');

  useEffect(() => {
    Promise.all([
      localDb.getSetting('locale'),
      localDb.getSetting('backup_path'),
    ])
      .then(([loc, bp]) => {
        if (loc === 'en' || loc === 'es') setLocale(loc);
        if (bp) setBackupPath(bp);
      })
      .catch(console.error);
  }, [localDb]);

  const handleLanguageSelect = (val: string) => {
    if (val !== 'en' && val !== 'es') return;
    setLocale(val as Locale);
    setRuntimeLocale(val as Locale);
    localDb.setSetting('locale', val).catch(console.error);
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>{t('global.language')}</Text>
      <SelectList
        items={[
          { label: 'English' + (locale === 'en' ? ' (Active)' : ''), value: 'en' },
          { label: 'Español' + (locale === 'es' ? ' (Active)' : ''), value: 'es' },
        ]}
        onSelect={handleLanguageSelect}
        focused={focused}
      />
      <Text bold>{t('global.backup_path')}</Text>
      <Text dimColor>{backupPath}</Text>
    </Box>
  );
}
