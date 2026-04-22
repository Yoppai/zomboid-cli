import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { HttpLatencyPinger, GCP_PING_ENDPOINTS } from '@/shared/infra/networking/http-latency-pinger.ts';

describe('HttpLatencyPinger', () => {
  beforeEach(() => {
    (globalThis as any).fetch = mock(async () => ({ ok: true }));
  });

  it('defines non-empty region endpoint map', () => {
    expect(Object.keys(GCP_PING_ENDPOINTS).length).toBeGreaterThan(0);
    expect(GCP_PING_ENDPOINTS['us-central1']).toContain('https://');
  });

  it('measureLatency uses HTTP fetch and returns finite median latency', async () => {
    const pinger = new HttpLatencyPinger({ timeoutMs: 3000 });
    const latency = await pinger.measureLatency('https://example.com/ping');
    expect((globalThis as any).fetch).toHaveBeenCalled();
    expect(latency).toBeGreaterThanOrEqual(0);
    expect(latency).not.toBe(Infinity);
  });

  it('measureLatency returns Infinity on timeout', async () => {
    (globalThis as any).fetch = mock(async () => {
      await new Promise((r) => setTimeout(r, 10_000));
      return { ok: true };
    });

    const pinger = new HttpLatencyPinger({ timeoutMs: 20 });
    const latency = await pinger.measureLatency('https://example.com/slow');
    expect(latency).toBe(Infinity);
  });

  it('pingAllRegions sorts ascending and pushes timeout to bottom', async () => {
    const pinger = new HttpLatencyPinger({
      timeoutMs: 50,
      endpoints: {
        'us-east1': 'https://ok.example.com',
        'asia-east1': 'https://timeout.example.com',
      },
      fetchFn: mock(async (url: string) => {
        if (url.includes('timeout')) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        return { ok: true } as any;
      }),
    });

    const result = await pinger.pingAllRegions();
    expect(result[0]?.region).toBe('us-east1');
    expect(result[1]?.region).toBe('asia-east1');
    expect(result[1]?.latencyMs).toBe(Infinity);
  });
});
