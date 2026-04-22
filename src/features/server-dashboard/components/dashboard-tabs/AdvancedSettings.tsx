import React from 'react';
import { Box, Text } from 'ink';
import * as path from 'node:path';
import { FilePickerButton } from '@/shared/components/common/FilePickerButton.tsx';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import { useStore } from 'zustand';
import { useServices } from '@/shared/hooks/use-services.tsx';

export interface AdvancedSettingsProps {
  readonly server: ServerRecord;
}

export function AdvancedSettings({ server }: AdvancedSettingsProps) {
  const { notificationStore, sftpGateway } = useServices();

  const handleSelect = async (file: string, expectedExtensions: string[]) => {
    const ext = path.extname(file).toLowerCase();
    if (!expectedExtensions.includes(ext)) {
      notificationStore.getState().add('error', `Only ${expectedExtensions.join(' and ')} files are supported`);
      return;
    }
    if (!sftpGateway) {
      notificationStore.getState().add('error', 'SFTP gateway not available');
      return;
    }
    
    try {
      if (!server.staticIp) {
        notificationStore.getState().add('error', 'Server IP not available');
        return;
      }

      const conn = {
        host: server.staticIp,
        port: 22,
        username: 'ubuntu',
        privateKey: server.sshPrivateKey,
      };
      
      const remotePath = `/opt/zomboid/config/${path.basename(file)}`;
      await sftpGateway.upload(conn, file, remotePath);
      
      notificationStore.getState().add('success', `Uploaded ${path.basename(file)} successfully`);
    } catch (err: any) {
      notificationStore.getState().add('error', `Failed to upload file: ${err.message}`);
    }
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Advanced Settings (BYOC)</Text>
      <Text>Upload your own configuration files (.ini, .lua) directly to the server.</Text>
      
      <FilePickerButton
        label="Select SandboxVars.lua"
        selectedFile={undefined}
        onSelect={(file) => handleSelect(file, ['.lua'])}
      />
      
      <FilePickerButton
        label="Select servertest.ini"
        selectedFile={undefined}
        onSelect={(file) => handleSelect(file, ['.ini'])}
      />
      
      <FilePickerButton
        label="Select spawnregions.lua"
        selectedFile={undefined}
        onSelect={(file) => handleSelect(file, ['.lua'])}
      />
    </Box>
  );
}

