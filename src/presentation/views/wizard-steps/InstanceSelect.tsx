import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { SelectList } from '@/presentation/components/SelectList.tsx';
import { Spinner } from '@/presentation/components/Spinner.tsx';
import { TextInput } from '@/presentation/components/TextInput.tsx';
import type { WizardStore } from '@/presentation/store/wizard-store.ts';
import { GCP_MACHINE_CATALOG } from '@/domain/entities/index.ts';
import type { MachineType } from '@/domain/entities/value-objects.ts';

export interface InstanceSelectProps {
  readonly wizardStore: WizardStore;
  readonly onLoadDynamicCatalog?: () => Promise<readonly MachineType[]>;
}

export function InstanceSelect({ wizardStore, onLoadDynamicCatalog }: InstanceSelectProps) {
  const [mode, setMode] = useState<'select' | 'dynamic'>('select');
  const [manualMachineType, setManualMachineType] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [dynamicCatalog, setDynamicCatalog] = useState<readonly MachineType[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const items = GCP_MACHINE_CATALOG.map((m) => ({
    label: `${m.label} - ${m.id} (${m.totalRamGb}GB RAM, ${m.serverMemoryGb}GB JVM, ${m.maxPlayers} players)`,
    value: m.id,
  }));

  const allItems = useMemo(
    () => [
      ...items,
      {
        label: 'Dynamic Catalog (manual machine type)',
        value: '__dynamic__',
      },
    ],
    [items],
  );

  useEffect(() => {
    if (mode !== 'dynamic' || !onLoadDynamicCatalog) {
      return;
    }

    let active = true;
    setLoadingCatalog(true);
    setValidationError(null);

    onLoadDynamicCatalog()
      .then((catalog) => {
        if (!active) {
          return;
        }
        setDynamicCatalog(catalog);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setValidationError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) {
          setLoadingCatalog(false);
        }
      });

    return () => {
      active = false;
    };
  }, [mode, onLoadDynamicCatalog]);

  if (mode === 'dynamic') {
    if (loadingCatalog) {
      return <Spinner label="Loading dynamic catalog..." />;
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Dynamic Catalog</Text>
        <Text>Enter machine type available for selected region.</Text>
        <TextInput
          label="Machine Type"
          placeholder="e2-standard-4"
          value={manualMachineType}
          onChange={setManualMachineType}
          onSubmit={() => {
            const found = dynamicCatalog.find((m) => m.id === manualMachineType.trim());
            if (!found) {
              const region = wizardStore.getState().region ?? 'unknown';
              setValidationError(`Machine type not found in region ${region}`);
              return;
            }

            wizardStore.getState().setMachineType(found);
            wizardStore.getState().setStep(5);
          }}
        />
        {validationError ? <Text color="red">{validationError}</Text> : null}
        <Text dimColor>Press Enter to validate machine type.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Select Instance Type</Text>
      <SelectList
        items={allItems}
        onSelect={(val) => {
          if (val === '__dynamic__') {
            setMode('dynamic');
            return;
          }

          const type = GCP_MACHINE_CATALOG.find(m => m.id === val)!;
          wizardStore.getState().setMachineType(type);
          wizardStore.getState().setStep(5);
        }}
      />
    </Box>
  );
}
