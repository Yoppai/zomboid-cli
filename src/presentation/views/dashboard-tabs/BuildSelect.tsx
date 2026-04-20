import React from 'react';
import { Box, Text } from 'ink';
import { SelectList } from '@/presentation/components/SelectList.tsx';
import type { ServerRecord } from '@/domain/entities/server-record.ts';
import { useServices } from '@/presentation/hooks/use-services.tsx';

export interface BuildSelectProps {
  readonly server: ServerRecord;
  readonly focused?: boolean;
}

export function BuildSelect({ server, focused = false }: BuildSelectProps) {
  const { inventory } = useServices();

  const handleBranchSelect = async (val: string) => {
    // In a full implementation, we would update the server record and maybe trigger an update
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Game Branch Configuration</Text>
      <Text>Current Branch: {server.gameBranch}</Text>
      <Box marginTop={1}>
        <SelectList
          items={[
            { label: 'Stable', value: 'stable' },
            { label: 'Unstable', value: 'unstable' },
            { label: 'Outdated Unstable', value: 'outdatedunstable' },
          ]}
          onSelect={handleBranchSelect}
          focused={focused}
        />
      </Box>
    </Box>
  );
}
