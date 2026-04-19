import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useStore } from 'zustand';
import { SelectList } from '@/presentation/components/SelectList.tsx';
import { TextInput } from '@/presentation/components/TextInput.tsx';
import { KeyHint } from '@/presentation/components/KeyHint.tsx';
import type { WizardStore } from '@/presentation/store/wizard-store.ts';
import type { GameBranch } from '@/domain/entities/enums.ts';

export interface DeployConfirmProps {
  readonly wizardStore: WizardStore;
  readonly onDeploy?: (input: { serverName: string; gameBranch: GameBranch }) => void | Promise<void>;
}

export function DeployConfirm({ wizardStore, onDeploy }: DeployConfirmProps) {
  const state = useStore(wizardStore);
  const [serverName, setServerName] = useState(state.serverName);
  const [gameBranch, setGameBranch] = useState<GameBranch>(state.gameBranch);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const normalizedName = serverName.trim();
    if (!normalizedName) {
      setError('Server name is required');
      return;
    }

    setError(null);
    try {
      await onDeploy?.({ serverName: normalizedName, gameBranch });
    } catch (submitError) {
      let message = submitError instanceof Error ? submitError.message : String(submitError);
      if (submitError instanceof Error && submitError.cause instanceof Error) {
        message += `: ${submitError.cause.message}`;
      }
      setError(message);
    }
  };
  
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Confirm Deployment</Text>
      <Box flexDirection="column" borderStyle="single" padding={1}>
        <Text>Provider: {state.provider}</Text>
        <Text>Project: {state.projectId}</Text>
        <Text>Region: {state.region}</Text>
        <Text>Instance: {state.machineType?.label}</Text>
      </Box>

      <TextInput
        label="Server Name"
        placeholder="my-zomboid-server"
        value={serverName}
        onChange={(value) => {
          setServerName(value);
          wizardStore.getState().setServerName(value);
        }}
        onSubmit={() => {
          handleSubmit().catch(console.error);
        }}
      />

      {error ? <Text color="red">{error}</Text> : null}
      
      <Text bold>Game Branch</Text>
        <SelectList
          items={[
          { label: gameBranch === 'stable' ? 'stable (selected)' : 'stable', value: 'stable' },
          { label: gameBranch === 'unstable' ? 'unstable (selected)' : 'unstable', value: 'unstable' },
          { label: gameBranch === 'outdatedunstable' ? 'outdatedunstable (selected)' : 'outdatedunstable', value: 'outdatedunstable' },
          ]}
          onSelect={(value) => {
            const branch = value as GameBranch;
            setGameBranch(branch);
            wizardStore.getState().setGameBranch(branch);
          }}
        />
      
      <KeyHint hints={[{ key: 'Enter', label: 'Deploy' }]} />
    </Box>
  );
}
