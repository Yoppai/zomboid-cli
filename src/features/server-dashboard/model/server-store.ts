import { createStore } from 'zustand/vanilla';
import type { ServerRecord, ServerId } from '@/shared/infra/entities/index.ts';

// ── Types ──

export interface ServerState {
  servers: readonly ServerRecord[];
  active: readonly ServerRecord[];
  archived: readonly ServerRecord[];
  activeServerId: ServerId | null;
  invalidationToken: number;
  hydrate: (servers: readonly ServerRecord[]) => void;
  hydrateActive: (servers: readonly ServerRecord[]) => void;
  hydrateArchived: (servers: readonly ServerRecord[]) => void;
  invalidate: (reason: 'deploy' | 'archive' | 'start' | 'stop' | 'recover' | 'restore') => Promise<void>;
  setActive: (id: ServerId | null) => void;
  updateOne: (id: ServerId, fields: Partial<ServerRecord>) => void;
  addOne: (server: ServerRecord) => void;
  removeOne: (id: ServerId) => void;
}

export type ServerStore = ReturnType<typeof createServerStore>;

// ── Factory ──

export function createServerStore() {
  return createStore<ServerState>((set, get) => ({
    servers: [],
    active: [],
    archived: [],
    activeServerId: null,
    invalidationToken: 0,

    hydrate: (servers) => set({ servers }),

    hydrateActive: (servers) => set({ active: servers }),

    hydrateArchived: (servers) => set({ archived: servers }),

    invalidate: async (reason) => {
      // Increment token to trigger re-fetch in polling hooks
      set((state) => ({ invalidationToken: state.invalidationToken + 1 }));
      // In a real implementation, this would trigger a re-hydrate from the backend
      // For now, just bump the token — components subscribe to re-fetch
      void reason;
      await get().hydrateActive([]);
      await get().hydrateArchived([]);
    },

    setActive: (id) => set({ activeServerId: id }),

    updateOne: (id, fields) =>
      set((state) => ({
        servers: state.servers.map((s) =>
          s.id === id ? { ...s, ...fields } : s,
        ),
        active: state.active.map((s) =>
          s.id === id ? { ...s, ...fields } : s,
        ),
        archived: state.archived.map((s) =>
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
        active: state.active.filter((s) => s.id !== id),
        archived: state.archived.filter((s) => s.id !== id),
        activeServerId: state.activeServerId === id ? null : state.activeServerId,
      })),
  }));
}
