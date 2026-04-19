import { useState, useCallback } from 'react';
import { useServices } from './use-services.tsx';
import type { RegionLatency } from '@/domain/entities/value-objects.ts';

export function useLatency() {
  const { latency } = useServices();
  const [latencies, setLatencies] = useState<readonly RegionLatency[]>([]);
  const [measuring, setMeasuring] = useState(false);

  const measure = useCallback(async () => {
    setMeasuring(true);
    try {
      const results = await latency.measureAllRegions();
      setLatencies(results);
      return results;
    } finally {
      setMeasuring(false);
    }
  }, [latency]);

  return { latencies, measuring, measure };
}
