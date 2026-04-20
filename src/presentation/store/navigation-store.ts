import { createStore } from 'zustand/vanilla';
import type { ServerId } from '@/domain/entities/index.ts';

// ── Types ──

export type ScreenName =
  | 'main-menu'
  | 'setup-wizard'
  | 'server-dashboard'
  | 'settings'
  | 'archived-servers';

export interface ScreenEntry {
  readonly screen: ScreenName;
  readonly params?: Record<string, unknown>;
}

// Shell context stack — replaces screen stack
export type ServerTabKey =
  | 'management'
  | 'build'
  | 'players'
  | 'stats'
  | 'basic'
  | 'advanced'
  | 'admins'
  | 'scheduler'
  | 'backups';

export type ShellContext =
  | { kind: 'main'; panel: 'active-servers' | 'archived' | 'global-settings' }
  | { kind: 'server'; serverId: ServerId; tab: ServerTabKey };

export type FocusRegion = 'sidebar' | 'main' | 'modal';

export interface NavigationState {
  // Legacy screen stack (kept for compatibility)
  stack: ScreenEntry[];
  current: ScreenEntry;
  canGoBack: boolean;
  push: (screen: ScreenName, params?: Record<string, unknown>) => void;
  pop: () => void;
  reset: () => void;
  // Shell context stack
  contextStack: readonly ShellContext[];
  focusRegion: FocusRegion;
  pushContext: (ctx: ShellContext) => void;
  popContext: () => void;
  setFocus: (region: FocusRegion) => void;
  selectSidebarItem: (key: string) => void;
  selectServerTab: (tab: ServerTabKey) => void;
}

export type NavigationStore = ReturnType<typeof createNavigationStore>;

// ── Initial state ──

const INITIAL_ENTRY: ScreenEntry = { screen: 'main-menu' };

// ── Factory ──

export function createNavigationStore() {
  return createStore<NavigationState>((set) => ({
    // Legacy screen stack
    stack: [INITIAL_ENTRY],
    current: INITIAL_ENTRY,
    canGoBack: false,

    push: (screen, params) =>
      set((state) => {
        const entry: ScreenEntry = params ? { screen, params } : { screen };
        const newStack = [...state.stack, entry];
        return {
          stack: newStack,
          current: entry,
          canGoBack: newStack.length > 1,
        };
      }),

    pop: () =>
      set((state) => {
        if (state.stack.length <= 1) return state;
        const newStack = state.stack.slice(0, -1);
        return {
          stack: newStack,
          current: newStack[newStack.length - 1]!,
          canGoBack: newStack.length > 1,
        };
      }),

    reset: () =>
      set(() => ({
        stack: [INITIAL_ENTRY],
        current: INITIAL_ENTRY,
        canGoBack: false,
      })),

    // Shell context stack — starts with main menu context
    contextStack: [{ kind: 'main', panel: 'active-servers' }] as readonly ShellContext[],
    focusRegion: 'sidebar' as FocusRegion,

    pushContext: (ctx) =>
      set((state) => ({
        contextStack: [...state.contextStack, ctx],
      })),

    popContext: () =>
      set((state) => {
        if (state.contextStack.length <= 1) return state;
        return {
          contextStack: state.contextStack.slice(0, -1),
        };
      }),

    setFocus: (region) => set({ focusRegion: region }),

    selectSidebarItem: (key) =>
      set((state) => {
        const top = state.contextStack[state.contextStack.length - 1];
        // create_server opens wizard — caller handles via handleSidebarSelect
        if (key === 'create_server') return state;
        // Guard: if top is already main with same panel, do nothing (no duplicate)
        if (top?.kind === 'main' && top.panel === key) return state;
        if (top?.kind === 'main') {
          return {
            contextStack: [...state.contextStack, { kind: 'main', panel: key as 'active-servers' | 'archived' | 'global-settings' }],
          };
        }
        return state;
      }),

    selectServerTab: (tab) =>
      set((state) => {
        const top = state.contextStack[state.contextStack.length - 1];
        if (top?.kind !== 'server') return state;
        return {
          contextStack: [...state.contextStack.slice(0, -1), { kind: 'server', serverId: top.serverId, tab }],
        };
      }),
  }));
}
