import { describe, it, expect, beforeEach } from 'bun:test';
import {
  createWizardStore,
  type WizardStore,
} from '@/presentation/store/wizard-store.ts';
import type { Provider, MachineType, RegionLatency } from '@/domain/entities/index.ts';

describe('WizardStore', () => {
  let store: WizardStore;

  beforeEach(() => {
    store = createWizardStore();
  });

  // ── Initial State ──

  describe('initial state', () => {
    it('should start at step 1 with all fields null', () => {
      const state = store.getState();
      expect(state.step).toBe(1);
      expect(state.provider).toBeNull();
      expect(state.projectId).toBeNull();
      expect(state.region).toBeNull();
      expect(state.zone).toBeNull();
      expect(state.machineType).toBeNull();
      expect(state.latencies).toEqual([]);
    });
  });

  // ── Step navigation ──

  describe('setStep', () => {
    it('should advance to step 2', () => {
      store.getState().setStep(2);
      expect(store.getState().step).toBe(2);
    });

    it('should advance to step 5', () => {
      store.getState().setStep(5);
      expect(store.getState().step).toBe(5);
    });

    it('should go back to step 1', () => {
      store.getState().setStep(3);
      store.getState().setStep(1);
      expect(store.getState().step).toBe(1);
    });
  });

  // ── Provider selection ──

  describe('setProvider', () => {
    it('should set provider to gcp', () => {
      store.getState().setProvider('gcp');
      expect(store.getState().provider).toBe('gcp');
    });

    it('should overwrite previous provider', () => {
      store.getState().setProvider('gcp');
      store.getState().setProvider('aws');
      expect(store.getState().provider).toBe('aws');
    });
  });

  // ── Project selection ──

  describe('setProject', () => {
    it('should set projectId', () => {
      store.getState().setProject('my-gcp-project');
      expect(store.getState().projectId).toBe('my-gcp-project');
    });

    it('should overwrite previous projectId', () => {
      store.getState().setProject('project-a');
      store.getState().setProject('project-b');
      expect(store.getState().projectId).toBe('project-b');
    });
  });

  // ── Region + Zone selection ──

  describe('setRegion', () => {
    it('should set both region and zone', () => {
      store.getState().setRegion('us-central1', 'us-central1-a');
      const state = store.getState();
      expect(state.region).toBe('us-central1');
      expect(state.zone).toBe('us-central1-a');
    });

    it('should overwrite previous region/zone', () => {
      store.getState().setRegion('us-central1', 'us-central1-a');
      store.getState().setRegion('europe-west1', 'europe-west1-b');
      const state = store.getState();
      expect(state.region).toBe('europe-west1');
      expect(state.zone).toBe('europe-west1-b');
    });
  });

  // ── Machine type selection ──

  describe('setMachineType', () => {
    const smallMachine: MachineType = {
      id: 'e2-standard-2',
      label: 'Small Co-op (1-8)',
      totalRamGb: 8,
      serverMemoryGb: 6,
      maxPlayers: '1-8',
    };

    const largeMachine: MachineType = {
      id: 'c2-standard-8',
      label: 'Massive (64+)',
      totalRamGb: 32,
      serverMemoryGb: 26,
      maxPlayers: '64+',
    };

    it('should set machine type', () => {
      store.getState().setMachineType(smallMachine);
      expect(store.getState().machineType).toEqual(smallMachine);
    });

    it('should overwrite previous machine type', () => {
      store.getState().setMachineType(smallMachine);
      store.getState().setMachineType(largeMachine);
      expect(store.getState().machineType).toEqual(largeMachine);
    });
  });

  // ── Latencies ──

  describe('setLatencies', () => {
    const latencies: RegionLatency[] = [
      { region: 'us-central1', zone: 'us-central1-a', latencyMs: 45 },
      { region: 'europe-west1', zone: 'europe-west1-b', latencyMs: 120 },
    ];

    it('should set latencies array', () => {
      store.getState().setLatencies(latencies);
      const state = store.getState();
      expect(state.latencies).toHaveLength(2);
      expect(state.latencies[0]!.region).toBe('us-central1');
      expect(state.latencies[0]!.latencyMs).toBe(45);
    });

    it('should replace previous latencies', () => {
      store.getState().setLatencies(latencies);
      const newLatencies: RegionLatency[] = [
        { region: 'asia-east1', zone: 'asia-east1-a', latencyMs: 200 },
      ];
      store.getState().setLatencies(newLatencies);
      expect(store.getState().latencies).toHaveLength(1);
      expect(store.getState().latencies[0]!.region).toBe('asia-east1');
    });
  });

  // ── Reset ──

  describe('reset', () => {
    it('should clear all fields back to initial state', () => {
      // Set all fields
      store.getState().setStep(4);
      store.getState().setProvider('gcp');
      store.getState().setProject('my-project');
      store.getState().setRegion('us-central1', 'us-central1-a');
      store.getState().setMachineType({
        id: 'e2-standard-2',
        label: 'Small',
        totalRamGb: 8,
        serverMemoryGb: 6,
        maxPlayers: '1-8',
      });
      store.getState().setLatencies([
        { region: 'us-central1', zone: 'us-central1-a', latencyMs: 45 },
      ]);

      // Reset
      store.getState().reset();

      const state = store.getState();
      expect(state.step).toBe(1);
      expect(state.provider).toBeNull();
      expect(state.projectId).toBeNull();
      expect(state.region).toBeNull();
      expect(state.zone).toBeNull();
      expect(state.machineType).toBeNull();
      expect(state.latencies).toEqual([]);
    });

    it('should be safe to call from initial state', () => {
      store.getState().reset();
      const state = store.getState();
      expect(state.step).toBe(1);
      expect(state.provider).toBeNull();
    });
  });

  // ── Wizard flow simulation ──

  describe('full wizard flow', () => {
    it('should persist data across step changes', () => {
      store.getState().setStep(1);
      store.getState().setProvider('gcp');
      store.getState().setStep(2);
      store.getState().setProject('my-project');
      store.getState().setStep(3);

      // Data from previous steps should still be there
      const state = store.getState();
      expect(state.step).toBe(3);
      expect(state.provider).toBe('gcp');
      expect(state.projectId).toBe('my-project');
    });
  });
});
