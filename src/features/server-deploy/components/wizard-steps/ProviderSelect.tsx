import React from 'react';
import { Box, Text } from 'ink';
import { SelectList } from '@/shared/components/common/SelectList.tsx';
import type { WizardStore } from '@/features/server-deploy/model/wizard-store.ts';

export interface ProviderSelectProps {
  readonly wizardStore: WizardStore;
}

export function ProviderSelect({ wizardStore }: ProviderSelectProps) {
  const items = [
    { label: 'GCP (Google Cloud)', value: 'gcp' },
    { label: 'AWS (Coming Soon)', value: 'aws', disabled: true },
    { label: 'Azure (Coming Soon)', value: 'azure', disabled: true },
  ];

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Select Cloud Provider</Text>
      <SelectList
        items={items}
        onSelect={(value) => {
          if (value === 'gcp') {
            wizardStore.getState().setProvider('gcp');
            wizardStore.getState().setStep(2);
          }
        }}
      />
    </Box>
  );
}
