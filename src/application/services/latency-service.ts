import type { RegionLatency } from '@/domain/entities/value-objects.ts';
import { GCP_PING_ENDPOINTS } from '@/infrastructure/networking/http-latency-pinger.ts';

// ── Pinger Interface (injectable) ──

export interface IPinger {
  pingAllRegions(): Promise<readonly RegionLatency[]>;
}

// ── LatencyService ──

export class LatencyService {
  constructor(private readonly pinger: IPinger) {}

  /**
   * Measure latency to all regions and return sorted ascending (lowest first).
   * Timed-out regions (Infinity) sort to bottom.
   */
  async measureAllRegions(): Promise<readonly RegionLatency[]> {
    const results = await this.pinger.pingAllRegions();

    // Sort ascending — Infinity naturally sorts to bottom
    const sorted = [...results].sort((a, b) => a.latencyMs - b.latencyMs);
    return sorted;
  }

  /**
   * Returns list of all GCP regions available for latency testing.
   */
  getGcpRegions(): string[] {
    return Object.keys(GCP_PING_ENDPOINTS);
  }

  /**
   * Recommend the lowest-latency region.
   * Returns the first element after sorting (lowest latency).
   */
  async recommendRegion(): Promise<RegionLatency> {
    const sorted = await this.measureAllRegions();
    return sorted[0]!;
  }
}
