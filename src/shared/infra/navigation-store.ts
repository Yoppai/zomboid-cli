import { createStore } from 'zustand/vanilla';
import type { ServerId } from '@/shared/infra/entities/index.ts';

// ── Shell Context Stack ───────────────────────────────────────────────────────
// Replaces the legacy screen-stack model. Navigation is now purely context-based:
//   - Main context: panel selection (active-servers | archived | global-settings)
//   - Server context: server detail with tab selection
//   - ESC navigates context stack, never a raw screen stack

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

// ── Breakpoint Selector ───────────────────────────────────────────────────────

export type ShellBreakpoint = 'narrow' | 'default' | 'wide';

/**
 * Determines shell layout breakpoint based on terminal column count.
 * Used to drive responsive sidebar width and footer badge layout.
 */
export function getShellBreakpoint(columns: number): ShellBreakpoint {
  if (columns < 90) return 'narrow';
  if (columns < 120) return 'default';
  return 'wide';
}

export interface NavigationState {
  // Shell context stack — starts with main/active-servers
  contextStack: readonly ShellContext[];
  focusRegion: FocusRegion;
  pushContext: (ctx: ShellContext) => void;
  popContext: () => void;
  setFocus: (region: FocusRegion) => void;
  selectSidebarItem: (key: string) => void;
  selectServerTab: (tab: ServerTabKey) => void;
}

export type NavigationStore = ReturnType<typeof createNavigationStore>;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createNavigationStore() {
  return createStore<NavigationState>((set) => ({
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
