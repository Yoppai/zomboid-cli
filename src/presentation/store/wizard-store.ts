import { createStore } from 'zustand/vanilla';
import type { Provider, MachineType, RegionLatency } from '@/domain/entities/index.ts';
import type { GameBranch } from '@/domain/entities/enums.ts';

// ── Types ──

export interface WizardState {
  step: number;
  provider: Provider | null;
  projectId: string | null;
  region: string | null;
  zone: string | null;
  machineType: MachineType | null;
  serverName: string;
  gameBranch: GameBranch;
  latencies: readonly RegionLatency[];
  setStep: (step: number) => void;
  setProvider: (provider: Provider) => void;
  setProject: (projectId: string) => void;
  setRegion: (region: string, zone: string) => void;
  setMachineType: (mt: MachineType) => void;
  setServerName: (name: string) => void;
  setGameBranch: (branch: GameBranch) => void;
  setLatencies: (latencies: readonly RegionLatency[]) => void;
  reset: () => void;
}

export type WizardStore = ReturnType<typeof createWizardStore>;

// ── Initial state ──

const INITIAL_STATE = {
  step: 1,
  provider: null as Provider | null,
  projectId: null as string | null,
  region: null as string | null,
  zone: null as string | null,
  machineType: null as MachineType | null,
  serverName: '',
  gameBranch: 'stable' as GameBranch,
  latencies: [] as readonly RegionLatency[],
};

// ── Factory ──

export function createWizardStore() {
  return createStore<WizardState>((set) => ({
    ...INITIAL_STATE,

    setStep: (step) => set({ step }),

    setProvider: (provider) => set({ provider }),

    setProject: (projectId) => set({ projectId }),

    setRegion: (region, zone) => set({ region, zone }),

    setMachineType: (machineType) => set({ machineType }),

    setServerName: (serverName) => set({ serverName }),

    setGameBranch: (gameBranch) => set({ gameBranch }),

    setLatencies: (latencies) => set({ latencies }),

    reset: () => set({ ...INITIAL_STATE }),
  }));
}
