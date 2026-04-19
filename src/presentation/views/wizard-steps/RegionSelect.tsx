import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useStore } from 'zustand';
import { Spinner } from '@/presentation/components/Spinner.tsx';
import { SelectList, type SelectListItem } from '@/presentation/components/SelectList.tsx';
import type { WizardStore } from '@/presentation/store/wizard-store.ts';
import type { RegionLatency } from '@/domain/entities/index.ts';

export interface RegionSelectProps {
  readonly wizardStore: WizardStore;
  readonly latencies?: readonly RegionLatency[];
  readonly onMeasureLatency?: () => Promise<readonly RegionLatency[]>;
}

const CONTINENTS: Record<string, string> = {
  'us': 'North America',
  'northamerica': 'North America',
  'southamerica': 'South America',
  'europe': 'Europe',
  'asia': 'Asia',
  'australia': 'Oceania',
  'me': 'Middle East',
  'africa': 'Africa',
};

function getContinent(region: string): string {
  const prefix = region.split('-')[0] || '';
  return CONTINENTS[prefix] || 'Other';
}

export function RegionSelect({ wizardStore, latencies, onMeasureLatency }: RegionSelectProps) {
  const storeLatencies = useStore(wizardStore, s => s.latencies);
  const [data, setData] = useState<readonly RegionLatency[] | null>(latencies || storeLatencies);

  useEffect(() => {
    if ((!data || data.length === 0) && onMeasureLatency) {
      onMeasureLatency().then(setData).catch(console.error);
    }
  }, [onMeasureLatency, data]);

  if (!data || data.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Select Region</Text>
        <Box paddingLeft={2}>
          <Spinner label="Measuring latency to GCP regions..." />
        </Box>
      </Box>
    );
  }

  // Group by continent
  const groups = new Map<string, RegionLatency[]>();
  for (const l of data) {
    const continent = getContinent(l.region);
    if (!groups.has(continent)) groups.set(continent, []);
    groups.get(continent)!.push(l);
  }

  // Sort continents by their lowest ping
  const sortedContinents = Array.from(groups.entries())
    .map(([name, regions]) => {
      const minLatency = Math.min(...regions.map(r => r.latencyMs));
      return { 
        name, 
        regions: regions.sort((a, b) => a.latencyMs - b.latencyMs), 
        minLatency 
      };
    })
    .sort((a, b) => a.minLatency - b.minLatency);

  const items: SelectListItem[] = [];
  for (const { name, regions } of sortedContinents) {
    // Add continent header (disabled)
    items.push({ 
      label: `--- ${name.toUpperCase()} ---`, 
      value: `group-${name}`, 
      disabled: true 
    });
    
    // Add regions in this continent
    for (const l of regions) {
      items.push({
        label: `${l.region} (${l.latencyMs === Infinity ? 'Timeout' : Math.round(l.latencyMs) + 'ms'})`,
        value: `${l.region}:${l.zone}`,
      });
    }
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Select Region</Text>
      <SelectList
        items={items}
        onSelect={(val) => {
          const [region, zone] = val.split(':');
          wizardStore.getState().setRegion(region!, zone!);
          wizardStore.getState().setStep(4);
        }}
      />
    </Box>
  );
}
