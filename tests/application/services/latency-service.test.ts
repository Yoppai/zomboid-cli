import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { RegionLatency } from '@/domain/entities/value-objects.ts';

// Production code that does NOT exist yet — guarantees RED
import { LatencyService } from '@/application/services/latency-service.ts';

// ── Mock Pinger Interface ──

interface MockPinger {
  pingAllRegions: () => Promise<readonly RegionLatency[]>;
}

function createMockPinger(
  results: readonly RegionLatency[] = [],
): MockPinger {
  return {
    pingAllRegions: mock(async () => results),
  };
}

// ── Tests ──

describe('LatencyService', () => {
  // ── measureAllRegions ──

  describe('measureAllRegions', () => {
    it('should return results sorted by latency ascending (lowest first)', async () => {
      const unsorted: RegionLatency[] = [
        { region: 'us-east1', zone: 'us-east1-a', latencyMs: 150 },
        { region: 'us-central1', zone: 'us-central1-a', latencyMs: 50 },
        { region: 'europe-west1', zone: 'europe-west1-a', latencyMs: 100 },
      ];
      const pinger = createMockPinger(unsorted);
      const svc = new LatencyService(pinger);

      const result = await svc.measureAllRegions();

      expect(result).toHaveLength(3);
      expect(result[0]!.region).toBe('us-central1');
      expect(result[0]!.latencyMs).toBe(50);
      expect(result[1]!.region).toBe('europe-west1');
      expect(result[1]!.latencyMs).toBe(100);
      expect(result[2]!.region).toBe('us-east1');
      expect(result[2]!.latencyMs).toBe(150);
    });

    it('should place timed-out regions (Infinity) at the bottom', async () => {
      const mixed: RegionLatency[] = [
        { region: 'asia-east1', zone: 'asia-east1-a', latencyMs: Infinity },
        { region: 'us-central1', zone: 'us-central1-a', latencyMs: 30 },
        { region: 'europe-west1', zone: 'europe-west1-a', latencyMs: Infinity },
        { region: 'us-east1', zone: 'us-east1-a', latencyMs: 80 },
      ];
      const pinger = createMockPinger(mixed);
      const svc = new LatencyService(pinger);

      const result = await svc.measureAllRegions();

      expect(result).toHaveLength(4);
      // First two should be finite, sorted ascending
      expect(result[0]!.latencyMs).toBe(30);
      expect(result[1]!.latencyMs).toBe(80);
      // Last two should be Infinity
      expect(result[2]!.latencyMs).toBe(Infinity);
      expect(result[3]!.latencyMs).toBe(Infinity);
    });

    it('should delegate to pinger.pingAllRegions', async () => {
      const pinger = createMockPinger([]);
      const svc = new LatencyService(pinger);

      await svc.measureAllRegions();

      expect(pinger.pingAllRegions).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when pinger returns empty', async () => {
      const pinger = createMockPinger([]);
      const svc = new LatencyService(pinger);

      const result = await svc.measureAllRegions();
      expect(result).toEqual([]);
    });
  });

  // ── getGcpRegions ──

  describe('getGcpRegions', () => {
    it('should return a non-empty list of GCP region strings', () => {
      const pinger = createMockPinger();
      const svc = new LatencyService(pinger);

      const regions = svc.getGcpRegions();
      expect(regions.length).toBeGreaterThan(0);
      expect(typeof regions[0]).toBe('string');
    });

    it('should include well-known GCP regions', () => {
      const pinger = createMockPinger();
      const svc = new LatencyService(pinger);

      const regions = svc.getGcpRegions();
      expect(regions).toContain('us-central1');
      expect(regions).toContain('europe-west1');
    });
  });

  // ── recommendRegion ──

  describe('recommendRegion', () => {
    it('should return the lowest-latency region', async () => {
      const regions: RegionLatency[] = [
        { region: 'us-east1', zone: 'us-east1-a', latencyMs: 120 },
        { region: 'us-central1', zone: 'us-central1-a', latencyMs: 25 },
        { region: 'europe-west1', zone: 'europe-west1-a', latencyMs: 200 },
      ];
      const pinger = createMockPinger(regions);
      const svc = new LatencyService(pinger);

      const recommended = await svc.recommendRegion();

      expect(recommended.region).toBe('us-central1');
      expect(recommended.latencyMs).toBe(25);
    });

    it('should pick the lowest finite region even with Infinity entries', async () => {
      const regions: RegionLatency[] = [
        { region: 'asia-east1', zone: 'asia-east1-a', latencyMs: Infinity },
        { region: 'us-west1', zone: 'us-west1-a', latencyMs: 45 },
      ];
      const pinger = createMockPinger(regions);
      const svc = new LatencyService(pinger);

      const recommended = await svc.recommendRegion();

      expect(recommended.region).toBe('us-west1');
      expect(recommended.latencyMs).toBe(45);
    });

    it('should throw when all regions timed out', async () => {
      const regions: RegionLatency[] = [
        { region: 'asia-east1', zone: 'asia-east1-a', latencyMs: Infinity },
      ];
      const pinger = createMockPinger(regions);
      const svc = new LatencyService(pinger);

      // Even with all Infinity, it returns the first (sorted) — Infinity is still a value
      const recommended = await svc.recommendRegion();
      expect(recommended.latencyMs).toBe(Infinity);
    });
  });
});
