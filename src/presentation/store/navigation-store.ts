import { createStore } from 'zustand/vanilla';

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

export interface NavigationState {
  stack: ScreenEntry[];
  current: ScreenEntry;
  canGoBack: boolean;
  push: (screen: ScreenName, params?: Record<string, unknown>) => void;
  pop: () => void;
  reset: () => void;
}

export type NavigationStore = ReturnType<typeof createNavigationStore>;

// ── Initial state ──

const INITIAL_ENTRY: ScreenEntry = { screen: 'main-menu' };

// ── Factory ──

export function createNavigationStore() {
  return createStore<NavigationState>((set) => ({
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
  }));
}
