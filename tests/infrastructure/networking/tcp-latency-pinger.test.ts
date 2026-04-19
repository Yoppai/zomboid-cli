import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { TcpLatencyPinger, GCP_REGIONAL_ENDPOINTS } from '@/infrastructure/networking/tcp-latency-pinger.ts';
import type { RegionLatency } from '@/domain/entities/value-objects.ts';

describe('TcpLatencyPinger', () => {
  describe('GCP_REGIONAL_ENDPOINTS', () => {
    it('is a non-empty map of region → host+port', () => {
      expect(Object.keys(GCP_REGIONAL_ENDPOINTS).length).toBeGreaterThan(0);
    });

    it('has entries with host and port fields', () => {
      const firstKey = Object.keys(GCP_REGIONAL_ENDPOINTS)[0]!;
      const entry = GCP_REGIONAL_ENDPOINTS[firstKey]!;
      expect(typeof entry.host).toBe('string');
      expect(typeof entry.port).toBe('number');
    });

    it('includes us-central1 region', () => {
      expect(GCP_REGIONAL_ENDPOINTS['us-central1']).toBeDefined();
    });

    it('includes europe-west1 region', () => {
      expect(GCP_REGIONAL_ENDPOINTS['europe-west1']).toBeDefined();
    });
  });

  describe('measureLatency', () => {
    it('returns latency in milliseconds for a successful TCP connection', async () => {
      // Create a pinger with a mock connect function that resolves quickly
      const pinger = new TcpLatencyPinger({
        connectFn: async (_host: string, _port: number) => {
          // Simulate ~10ms TCP handshake
          await new Promise((r) => setTimeout(r, 5));
        },
      });

      const latency = await pinger.measureLatency('example.com', 443);
      expect(latency).toBeGreaterThanOrEqual(0);
      expect(latency).toBeLessThan(1000); // should be well under 1s
    });

    it('returns the median of 3 samples', async () => {
      let callCount = 0;
      const delays = [50, 10, 30]; // median should be ~30
      const pinger = new TcpLatencyPinger({
        connectFn: async () => {
          const delay = delays[callCount % delays.length]!;
          callCount++;
          await new Promise((r) => setTimeout(r, delay));
        },
      });

      const latency = await pinger.measureLatency('example.com', 443);
      // Median of ~50, ~10, ~30 should be around 30
      expect(callCount).toBe(3);
      expect(latency).toBeGreaterThanOrEqual(0);
    });

    it('returns Infinity when connection times out', async () => {
      const pinger = new TcpLatencyPinger({
        connectFn: async () => {
          // Simulate a timeout — never resolves within the timeout period
          await new Promise((r) => setTimeout(r, 10_000));
        },
        timeoutMs: 50, // very short timeout for test
      });

      const latency = await pinger.measureLatency('unreachable.com', 443);
      expect(latency).toBe(Infinity);
    });

    it('returns Infinity when connection throws an error', async () => {
      const pinger = new TcpLatencyPinger({
        connectFn: async () => {
          throw new Error('ECONNREFUSED');
        },
      });

      const latency = await pinger.measureLatency('bad-host.com', 443);
      expect(latency).toBe(Infinity);
    });
  });

  describe('pingAllRegions', () => {
    it('returns results sorted by latency ascending', async () => {
      // Create deterministic latencies per region
      const latencyMap: Record<string, number> = {
        'us-central1': 30,
        'europe-west1': 100,
        'asia-east1': 200,
      };

      const pinger = new TcpLatencyPinger({
        connectFn: async (host: string) => {
          // Extract region from host pattern
          const region = Object.keys(latencyMap).find((r) =>
            host.includes(r),
          );
          const delay = region ? latencyMap[region]! : 50;
          await new Promise((r) => setTimeout(r, delay));
        },
        endpoints: {
          'us-central1': { host: 'us-central1.test.com', port: 443 },
          'europe-west1': { host: 'europe-west1.test.com', port: 443 },
          'asia-east1': { host: 'asia-east1.test.com', port: 443 },
        },
      });

      const results = await pinger.pingAllRegions();
      expect(results.length).toBe(3);
      // Should be sorted ascending
      expect(results[0]!.region).toBe('us-central1');
      expect(results[1]!.region).toBe('europe-west1');
      expect(results[2]!.region).toBe('asia-east1');
      // Latencies should increase
      expect(results[0]!.latencyMs).toBeLessThanOrEqual(results[1]!.latencyMs);
      expect(results[1]!.latencyMs).toBeLessThanOrEqual(results[2]!.latencyMs);
    });

    it('sorts timed-out regions to the bottom (Infinity)', async () => {
      const pinger = new TcpLatencyPinger({
        connectFn: async (host: string) => {
          if (host.includes('asia')) {
            throw new Error('timeout');
          }
          await new Promise((r) => setTimeout(r, 5));
        },
        endpoints: {
          'us-central1': { host: 'us-central1.test.com', port: 443 },
          'asia-east1': { host: 'asia-east1.test.com', port: 443 },
        },
      });

      const results = await pinger.pingAllRegions();
      expect(results.length).toBe(2);
      // Successful region first
      expect(results[0]!.region).toBe('us-central1');
      expect(results[0]!.latencyMs).not.toBe(Infinity);
      // Failed region last
      expect(results[1]!.region).toBe('asia-east1');
      expect(results[1]!.latencyMs).toBe(Infinity);
    });

    it('pings all regions concurrently (not sequentially)', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const pinger = new TcpLatencyPinger({
        connectFn: async () => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          await new Promise((r) => setTimeout(r, 20));
          concurrentCount--;
        },
        endpoints: {
          'region-a': { host: 'a.test.com', port: 443 },
          'region-b': { host: 'b.test.com', port: 443 },
          'region-c': { host: 'c.test.com', port: 443 },
        },
      });

      await pinger.pingAllRegions();
      // All 3 regions should run concurrently (each calls connectFn 3 times for median)
      // But at minimum, multiple regions must overlap
      expect(maxConcurrent).toBeGreaterThan(1);
    });

    it('assigns zone suffix -a to each region', async () => {
      const pinger = new TcpLatencyPinger({
        connectFn: async () => {
          await new Promise((r) => setTimeout(r, 1));
        },
        endpoints: {
          'us-central1': { host: 'us.test.com', port: 443 },
        },
      });

      const results = await pinger.pingAllRegions();
      expect(results[0]!.zone).toBe('us-central1-a');
    });

    it('returns readonly array of RegionLatency', async () => {
      const pinger = new TcpLatencyPinger({
        connectFn: async () => {},
        endpoints: {
          'us-east1': { host: 'us.test.com', port: 443 },
        },
      });

      const results = await pinger.pingAllRegions();
      expect(results.length).toBe(1);
      expect(results[0]!.region).toBe('us-east1');
      expect(results[0]!.zone).toBe('us-east1-a');
      expect(typeof results[0]!.latencyMs).toBe('number');
    });
  });
});
