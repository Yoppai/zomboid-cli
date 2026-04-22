import type { MachineType } from './value-objects.ts';

// ── GCP Machine Catalog (3 curated tiers) ──

export const GCP_MACHINE_CATALOG: readonly MachineType[] = Object.freeze([
  {
    id: 'e2-standard-2',
    label: 'Small Co-op (1-8)',
    totalRamGb: 8,
    serverMemoryGb: 6,
    maxPlayers: '1-8',
  },
  {
    id: 'n2-standard-4',
    label: 'Community (16-32)',
    totalRamGb: 16,
    serverMemoryGb: 12,
    maxPlayers: '16-32',
  },
  {
    id: 'c2-standard-8',
    label: 'Massive (64+)',
    totalRamGb: 32,
    serverMemoryGb: 26,
    maxPlayers: '64+',
  },
]);

/**
 * Calculate server memory from total RAM using tiered reservation:
 * - ≤8GB: reserve 2GB
 * - 8–16GB: linear scale from 2GB to 4GB reserved
 * - 16–32GB: linear scale from 4GB to 6GB reserved
 * - Minimum server memory: 1GB
 */
export function calculateServerMemory(totalRamGb: number): number {
  let reserved: number;

  if (totalRamGb <= 8) {
    reserved = 2;
  } else if (totalRamGb <= 16) {
    // Linear interpolation: 2GB at 8GB → 4GB at 16GB
    reserved = 2 + ((totalRamGb - 8) / (16 - 8)) * (4 - 2);
  } else {
    // Linear interpolation: 4GB at 16GB → 6GB at 32GB
    reserved = 4 + ((totalRamGb - 16) / (32 - 16)) * (6 - 4);
  }

  return Math.max(1, totalRamGb - reserved);
}

/**
 * Find a machine type by its GCP ID.
 */
export function findMachineType(id: string): MachineType | undefined {
  return GCP_MACHINE_CATALOG.find((mt) => mt.id === id);
}
