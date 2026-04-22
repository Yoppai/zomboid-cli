import type { RegionLatency } from '@/shared/infra/entities/value-objects.ts';

// ── GCP Regional Endpoints for TCP Latency Measurement ──

/**
 * GCP regional endpoints — we ping the Google Compute Engine metadata
 * API on port 443 (HTTPS) for each region. These are well-known,
 * always-available endpoints.
 */
export const GCP_REGIONAL_ENDPOINTS: Record<
  string,
  { host: string; port: number }
> = {
  'us-central1': { host: 'us-central1-run.googleapis.com', port: 443 },
  'us-east1': { host: 'us-east1-run.googleapis.com', port: 443 },
  'us-east4': { host: 'us-east4-run.googleapis.com', port: 443 },
  'us-west1': { host: 'us-west1-run.googleapis.com', port: 443 },
  'us-west2': { host: 'us-west2-run.googleapis.com', port: 443 },
  'us-west3': { host: 'us-west3-run.googleapis.com', port: 443 },
  'us-west4': { host: 'us-west4-run.googleapis.com', port: 443 },
  'us-south1': { host: 'us-south1-run.googleapis.com', port: 443 },
  'europe-west1': { host: 'europe-west1-run.googleapis.com', port: 443 },
  'europe-west2': { host: 'europe-west2-run.googleapis.com', port: 443 },
  'europe-west3': { host: 'europe-west3-run.googleapis.com', port: 443 },
  'europe-west4': { host: 'europe-west4-run.googleapis.com', port: 443 },
  'europe-west6': { host: 'europe-west6-run.googleapis.com', port: 443 },
  'europe-north1': { host: 'europe-north1-run.googleapis.com', port: 443 },
  'asia-east1': { host: 'asia-east1-run.googleapis.com', port: 443 },
  'asia-east2': { host: 'asia-east2-run.googleapis.com', port: 443 },
  'asia-northeast1': { host: 'asia-northeast1-run.googleapis.com', port: 443 },
  'asia-northeast2': { host: 'asia-northeast2-run.googleapis.com', port: 443 },
  'asia-northeast3': { host: 'asia-northeast3-run.googleapis.com', port: 443 },
  'asia-south1': { host: 'asia-south1-run.googleapis.com', port: 443 },
  'asia-southeast1': { host: 'asia-southeast1-run.googleapis.com', port: 443 },
  'asia-southeast2': { host: 'asia-southeast2-run.googleapis.com', port: 443 },
  'australia-southeast1': {
    host: 'australia-southeast1-run.googleapis.com',
    port: 443,
  },
  'southamerica-east1': {
    host: 'southamerica-east1-run.googleapis.com',
    port: 443,
  },
  'northamerica-northeast1': {
    host: 'northamerica-northeast1-run.googleapis.com',
    port: 443,
  },
  'me-west1': { host: 'me-west1-run.googleapis.com', port: 443 },
};

// ── Default TCP connect function using Bun.connect ──

async function defaultTcpConnect(host: string, port: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const socket = Bun.connect({
      hostname: host,
      port,
      socket: {
        open(socket) {
          socket.end();
          resolve();
        },
        error(_socket, error) {
          reject(error);
        },
        data() {},
        close() {},
      },
    });
  });
}

// ── Options for injectable dependencies ──

interface TcpLatencyPingerOptions {
  /** Injectable TCP connect function (for testing). Defaults to Bun.connect. */
  connectFn?: (host: string, port: number) => Promise<void>;
  /** Per-ping timeout in milliseconds. Default: 3000. */
  timeoutMs?: number;
  /** Custom endpoints map (for testing). Defaults to GCP_REGIONAL_ENDPOINTS. */
  endpoints?: Record<string, { host: string; port: number }>;
}

// ── TCP Latency Pinger ──

/**
 * Measures TCP handshake latency to GCP regional endpoints.
 *
 * Uses pure TCP connections (no HTTP), takes 3 samples per endpoint
 * and returns the median. All regions are pinged concurrently.
 */
export class TcpLatencyPinger {
  private readonly connectFn: (host: string, port: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly endpoints: Record<string, { host: string; port: number }>;

  constructor(options?: TcpLatencyPingerOptions) {
    this.connectFn = options?.connectFn ?? defaultTcpConnect;
    this.timeoutMs = options?.timeoutMs ?? 3_000;
    this.endpoints = options?.endpoints ?? GCP_REGIONAL_ENDPOINTS;
  }

  /**
   * Measure TCP handshake latency to a single host.
   * Takes 3 samples and returns the median (ms).
   * Returns Infinity on timeout or connection error.
   */
  async measureLatency(host: string, port: number): Promise<number> {
    const samples: number[] = [];

    for (let i = 0; i < 3; i++) {
      try {
        const start = performance.now();
        await Promise.race([
          this.connectFn(host, port),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), this.timeoutMs),
          ),
        ]);
        const elapsed = performance.now() - start;
        samples.push(elapsed);
      } catch {
        return Infinity;
      }
    }

    // Return median of 3 samples
    samples.sort((a, b) => a - b);
    return samples[1]!;
  }

  /**
   * Ping all configured GCP regions concurrently.
   * Returns results sorted by latency ascending (timeouts at bottom).
   * Each region gets zone suffix `-a`.
   */
  async pingAllRegions(): Promise<readonly RegionLatency[]> {
    const entries = Object.entries(this.endpoints);

    const results = await Promise.allSettled(
      entries.map(async ([region, { host, port }]) => {
        const latencyMs = await this.measureLatency(host, port);
        return {
          region,
          zone: `${region}-a`,
          latencyMs,
        } satisfies RegionLatency;
      }),
    );

    const latencies: RegionLatency[] = results
      .filter(
        (r): r is PromiseFulfilledResult<RegionLatency> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);

    // Sort ascending by latency — Infinity sorts to bottom naturally
    latencies.sort((a, b) => a.latencyMs - b.latencyMs);

    return latencies;
  }
}
