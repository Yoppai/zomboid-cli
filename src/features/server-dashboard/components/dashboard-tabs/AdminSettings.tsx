import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@/shared/components/common/TextInput.tsx';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';

export interface AdminSettingsProps {
  readonly server: ServerRecord;
}

export function AdminSettings({ server }: AdminSettingsProps) {
  const [adminUsername, setAdminUsername] = useState('');

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Admin Management</Text>
      
      <Text>RCON Password (immutable): {server.rconPassword}</Text>
      
      <Box marginTop={1}>
        <TextInput
          label="Add Admin Username"
          value={adminUsername}
          onChange={setAdminUsername}
          onSubmit={() => { /* SFTP or RCON logic to add admin */ }}
        />
      </Box>
    </Box>
  );
}
