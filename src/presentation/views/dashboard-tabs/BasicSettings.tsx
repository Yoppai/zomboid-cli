import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@/presentation/components/TextInput.tsx';
import type { ServerRecord } from '@/domain/entities/server-record.ts';

export interface BasicSettingsProps {
  readonly server: ServerRecord;
}

export function BasicSettings({ server }: BasicSettingsProps) {
  const [publicName, setPublicName] = useState(server.name);
  const [password, setPassword] = useState('');

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Basic Server Settings</Text>
      
      <TextInput
        label="Public Server Name"
        value={publicName}
        onChange={setPublicName}
        onSubmit={() => { /* SFTP upload logic would go here */ }}
      />
      
      <TextInput
        label="Server Password (leave empty for public)"
        value={password}
        onChange={setPassword}
        onSubmit={() => { /* SFTP upload logic would go here */ }}
      />
      
      <Text dimColor>Press Enter on a field to save changes via SFTP.</Text>
    </Box>
  );
}
