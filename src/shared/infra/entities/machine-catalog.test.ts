import { describe, it, expect } from 'bun:test';
import {
  GCP_MACHINE_CATALOG,
  calculateServerMemory,
  findMachineType,
} from '@/shared/infra/entities/machine-catalog.ts';

describe('GCP_MACHINE_CATALOG', () => {
  it('should contain exactly 3 curated tiers', () => {
    expect(GCP_MACHINE_CATALOG).toHaveLength(3);
  });

  it('should have e2-standard-2 as Small Co-op tier', () => {
    const small = GCP_MACHINE_CATALOG[0];
    expect(small?.id).toBe('e2-standard-2');
    expect(small?.label).toBe('Small Co-op (1-8)');
    expect(small?.totalRamGb).toBe(8);
    expect(small?.serverMemoryGb).toBe(6);
    expect(small?.maxPlayers).toBe('1-8');
  });

  it('should have n2-standard-4 as Community tier', () => {
    const mid = GCP_MACHINE_CATALOG[1];
    expect(mid?.id).toBe('n2-standard-4');
    expect(mid?.label).toBe('Community (16-32)');
    expect(mid?.totalRamGb).toBe(16);
    expect(mid?.serverMemoryGb).toBe(12);
    expect(mid?.maxPlayers).toBe('16-32');
  });

  it('should have c2-standard-8 as Massive tier', () => {
    const large = GCP_MACHINE_CATALOG[2];
    expect(large?.id).toBe('c2-standard-8');
    expect(large?.label).toBe('Massive (64+)');
    expect(large?.totalRamGb).toBe(32);
    expect(large?.serverMemoryGb).toBe(26);
    expect(large?.maxPlayers).toBe('64+');
  });

  it('should be readonly (frozen)', () => {
    expect(Object.isFrozen(GCP_MACHINE_CATALOG)).toBe(true);
  });
});

describe('calculateServerMemory', () => {
  it('should reserve 2GB for 8GB total (8 - 2 = 6)', () => {
    expect(calculateServerMemory(8)).toBe(6);
  });

  it('should reserve 2GB for 4GB total (4 - 2 = 2)', () => {
    expect(calculateServerMemory(4)).toBe(2);
  });

  it('should reserve 4GB for 16GB total (16 - 4 = 12)', () => {
    expect(calculateServerMemory(16)).toBe(12);
  });

  it('should reserve 6GB for 32GB total (32 - 6 = 26)', () => {
    expect(calculateServerMemory(32)).toBe(26);
  });

  it('should reserve 3GB for 12GB total (scaling between 8-16)', () => {
    // Linear interpolation: 2GB base + (12-8)/(16-8) * (4-2) = 2 + 1 = 3
    expect(calculateServerMemory(12)).toBe(9);
  });

  it('should reserve 5GB for 24GB total (scaling between 16-32)', () => {
    // Linear interpolation: 4GB base + (24-16)/(32-16) * (6-4) = 4 + 1 = 5
    expect(calculateServerMemory(24)).toBe(19);
  });

  it('should handle minimum 2GB total (clamp to at least 1GB server memory)', () => {
    expect(calculateServerMemory(2)).toBe(1);
  });
});

describe('findMachineType', () => {
  it('should find e2-standard-2 by id', () => {
    const result = findMachineType('e2-standard-2');
    expect(result).toBeDefined();
    expect(result?.id).toBe('e2-standard-2');
    expect(result?.totalRamGb).toBe(8);
  });

  it('should find n2-standard-4 by id', () => {
    const result = findMachineType('n2-standard-4');
    expect(result).toBeDefined();
    expect(result?.id).toBe('n2-standard-4');
  });

  it('should find c2-standard-8 by id', () => {
    const result = findMachineType('c2-standard-8');
    expect(result).toBeDefined();
    expect(result?.id).toBe('c2-standard-8');
  });

  it('should return undefined for unknown machine type id', () => {
    const result = findMachineType('non-existent-machine');
    expect(result).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    const result = findMachineType('');
    expect(result).toBeUndefined();
  });
});

