import { createStore } from 'zustand/vanilla';
import type { ServerRecord, ServerId } from '@/domain/entities/index.ts';

// ── Types ──

export interface ServerState {
  servers: readonly ServerRecord[];
  activeServerId: ServerId | null;
  hydrate: (servers: readonly ServerRecord[]) => void;
  setActive: (id: ServerId | null) => void;
  updateOne: (id: ServerId, fields: Partial<ServerRecord>) => void;
  addOne: (server: ServerRecord) => void;
  removeOne: (id: ServerId) => void;
}

export type ServerStore = ReturnType<typeof createServerStore>;

// ── Factory ──

export function createServerStore() {
  return createStore<ServerState>((set) => ({
    servers: [],
    activeServerId: null,

    hydrate: (servers) => set({ servers }),

    setActive: (id) => set({ activeServerId: id }),

    updateOne: (id, fields) =>
      set((state) => ({
        servers: state.servers.map((s) =>
          s.id === id ? { ...s, ...fields } : s,
        ),
      })),

    addOne: (server) =>
      set((state) => ({
        servers: [...state.servers, server],
      })),

    removeOne: (id) =>
      set((state) => ({
        servers: state.servers.filter((s) => s.id !== id),
        activeServerId: state.activeServerId === id ? null : state.activeServerId,
      })),
  }));
}
