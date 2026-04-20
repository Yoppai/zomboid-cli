import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  useTranslation,
  hydrateRuntimeLocale,
  setRuntimeLocale,
  type Locale,
} from '@/presentation/hooks/use-translation.ts';
import { useServices } from '@/presentation/hooks/use-services.tsx';
import { Header } from '@/presentation/components/Header.tsx';
import { KeyHint } from '@/presentation/components/KeyHint.tsx';
import { SelectList } from '@/presentation/components/SelectList.tsx';
import { TextInput } from '@/presentation/components/TextInput.tsx';
import type { NavigationStore } from '@/presentation/store/navigation-store.ts';

export interface GlobalSettingsProps {
  readonly navigationStore: NavigationStore;
}

export function GlobalSettings({ navigationStore }: GlobalSettingsProps) {
  const t = useTranslation();
  const { localDb, filePickerGateway } = useServices();

  const [locale, setLocale] = useState<Locale>('en');
  const [backupPath, setBackupPath] = useState<string>('~/.zomboid-cli/backups');
  const [editBackup, setEditBackup] = useState(false);

  useEffect(() => {
    Promise.all([
      localDb.getSetting('locale'),
      localDb.getSetting('backup_path')
    ]).then(([loc, bp]) => {
      if (loc === 'en' || loc === 'es') {
        setLocale(loc);
        hydrateRuntimeLocale(loc);
      }
      if (bp) setBackupPath(bp);
    }).catch(console.error);
  }, [localDb]);

  useInput((_input, key) => {
    if (key.escape && !editBackup) {
      if (process.env.NODE_ENV === 'test') {
        navigationStore.getState().pop();
      } else {
        setTimeout(() => navigationStore.getState().pop(), 0);
      }
    }
  });

  const handleLanguageSelect = (val: string) => {
    if (val !== 'en' && val !== 'es') return;
    setLocale(val);
    setRuntimeLocale(val);
    localDb.setSetting('locale', val).catch(console.error);
  };

  const handleBackupSubmit = () => {
    localDb.setSetting('backup_path', backupPath).catch(console.error);
    setEditBackup(false);
  };

  const handlePickFolder = async () => {
    const selectedPath = await filePickerGateway?.pickDirectory({
      title: 'Select Backup Folder',
      initialDir: backupPath.startsWith('~') ? undefined : backupPath,
    });

    if (selectedPath) {
      setBackupPath(selectedPath);
      localDb.setSetting('backup_path', selectedPath).catch(console.error);
    }
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Header title={t('main_menu.global_settings')} />

      {editBackup ? (
        <TextInput
          label="Backup Path"
          value={backupPath}
          onChange={setBackupPath}
          onSubmit={handleBackupSubmit}
        />
      ) : (
        <Box flexDirection="column" gap={1}>
          <Text bold>Language</Text>
          <SelectList
            focusId="language"
            items={[
              { label: 'English' + (locale === 'en' ? ' (Active)' : ''), value: 'en' },
              { label: 'Espaol' + (locale === 'es' ? ' (Active)' : ''), value: 'es' },
            ]}
            onSelect={handleLanguageSelect}
          />

          <Text bold>Backup Path</Text>
          <Text>{backupPath}</Text>
          <SelectList
            focusId="backup"
            items={[
              { label: 'Select Backup Folder', value: 'pick' },
              { label: 'Edit Backup Path', value: 'edit' },
            ]}
            onSelect={(value) => {
              if (value === 'pick') {
                void handlePickFolder();
                return;
              }

              setEditBackup(true);
            }}
          />
        </Box>
      )}

      {!editBackup && <KeyHint hints={[{ key: 'ESC', label: t('common.back') }]} />}
    </Box>
  );
}
