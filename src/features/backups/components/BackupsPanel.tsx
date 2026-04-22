import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { SelectList } from '@/shared/components/common/SelectList.tsx';
import { useServices } from '@/shared/hooks/use-services.tsx';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { BackupMeta } from '@/shared/infra/entities/value-objects.ts';

export interface BackupsPanelProps {
  readonly server: ServerRecord;
  readonly focused?: boolean;
}

export function BackupsPanel({ server, focused = false }: BackupsPanelProps) {
  const { backup, notificationStore } = useServices();
  const [backups, setBackups] = useState<readonly BackupMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    backup.list(server.name, '').then(setBackups).catch(console.error);
  }, [backup, server.name]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      await backup.create(server.id);
      const list = await backup.list(server.name, '');
      setBackups(list);
      notificationStore.getState().add('success', 'Backup created successfully');
    } catch (e: any) {
      notificationStore.getState().add('error', `Failed to create backup: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (filename: string) => {
    const b = backups.find(x => x.filename === filename);
    if (!b) return;

    setRestoring(true);
    try {
      await backup.restore(server.id, b.localPath);
      notificationStore.getState().add('success', `Restored ${filename} successfully`);
    } catch (e: any) {
      notificationStore.getState().add('error', `Failed to restore backup: ${e.message}`);
    } finally {
      setRestoring(false);
    }
  };

  if (loading) return <Box padding={1}><Text>Creating backup...</Text></Box>;
  if (restoring) return <Box padding={1}><Text>Restoring backup... (Server will restart)</Text></Box>;

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Backups</Text>
      
      {backups.length === 0 ? (
        <Box flexDirection="column" gap={1}>
          <Text>No backups found.</Text>
          <SelectList
            focused={focused}
            items={[{ label: 'Create First Backup', value: 'create' }]}
            onSelect={() => handleCreate()}
          />
        </Box>
      ) : (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>Select a backup to Restore or Create New:</Text>
          <SelectList
            focused={focused}
            items={[
              ...backups.map(b => ({
                label: `Restore: ${b.filename} (${Math.round(b.sizeBytes / 1024 / 1024)}MB)`,
                value: b.filename
              })),
              { label: '--- Create New Backup ---', value: 'create' }
            ]}
            onSelect={(val) => {
              if (val === 'create') handleCreate();
              else handleRestore(val);
            }}
          />
        </Box>
      )}
    </Box>
  );
}
