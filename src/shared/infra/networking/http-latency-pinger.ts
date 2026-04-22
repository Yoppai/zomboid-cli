import type { RegionLatency } from '@/shared/infra/entities/value-objects.ts';

//  Fallback GCP Regional Endpoints for HTTP Ping 
// These are the real Cloud Run endpoints used by gcping.com
export const GCP_PING_ENDPOINTS: Record<string, string> = {
  'us-central1': 'https://us-central1-5tkroniexa-uc.a.run.app',
  'us-east1': 'https://us-east1-5tkroniexa-ue.a.run.app',
  'us-east4': 'https://us-east4-5tkroniexa-uk.a.run.app',
  'us-west1': 'https://us-west1-5tkroniexa-uw.a.run.app',
  'europe-west1': 'https://europe-west1-5tkroniexa-ew.a.run.app',
  'europe-west4': 'https://europe-west4-5tkroniexa-ez.a.run.app',
  'asia-east1': 'https://asia-east1-5tkroniexa-de.a.run.app',
  'asia-southeast1': 'https://asia-southeast1-5tkroniexa-as.a.run.app',
};

interface HttpLatencyPingerOptions {
  timeoutMs?: number;
  endpoints?: Record<string, string>;
  fetchFn?: (url: string, init?: RequestInit) => Promise<unknown>;
}

export class HttpLatencyPinger {
  private readonly timeoutMs: number;
  private endpoints: Record<string, string>;
  private readonly fetchFn: (url: string, init?: RequestInit) => Promise<any>;

  constructor(options?: HttpLatencyPingerOptions) {
    this.timeoutMs = options?.timeoutMs ?? 3_000;
    this.endpoints = options?.endpoints ?? GCP_PING_ENDPOINTS;
    this.fetchFn = options?.fetchFn ?? ((url, init) => fetch(url, init));
  }

  async fetchDynamicEndpoints(): Promise<void> {
    try {
      const res = await this.fetchFn('https://gcping.com/api/endpoints');
      if (!res.ok) return;
      const data = await res.json();
      const dynamicEndpoints: Record<string, string> = {};
      for (const [key, val] of Object.entries(data)) {
        if (key === 'global') continue;
        const regionData = val as { URL: string };
        if (regionData.URL) {
          dynamicEndpoints[key] = regionData.URL;
        }
      }
      if (Object.keys(dynamicEndpoints).length > 0) {
        this.endpoints = dynamicEndpoints;
      }
    } catch {
      // Ignore and use fallback endpoints
    }
  }

  async measureLatency(baseUrl: string): Promise<number> {
    const samples: number[] = [];
    const url = `${baseUrl}/api/ping`;

    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      try {
        await Promise.race([
          this.fetchFn(url, { method: 'GET' }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), this.timeoutMs),
          ),
        ]);
        samples.push(performance.now() - start);
      } catch {
        return Infinity;
      }
    }

    samples.sort((a, b) => a - b);
    return samples[1] ?? Infinity;
  }

  async pingAllRegions(): Promise<readonly RegionLatency[]> {
    await this.fetchDynamicEndpoints();
    const entries = Object.entries(this.endpoints);
    const measured = await Promise.all(
      entries.map(async ([region, url]) => ({
        region,
        zone: `${region}-a`,
        latencyMs: await this.measureLatency(url),
      })),
    );

    measured.sort((a, b) => a.latencyMs - b.latencyMs);
    return measured;
  }
}

