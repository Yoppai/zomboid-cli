import { describe, it, expect, beforeEach } from 'bun:test';
import { createNavigationStore, type NavigationStore, type ShellContext, type FocusRegion } from '@/presentation/store/navigation-store.ts';
import { createServerId } from '@/domain/entities/index.ts';

describe('NavigationState — Shell Context Stack', () => {
  let store: NavigationStore;

  beforeEach(() => {
    store = createNavigationStore();
  });

  // Type guard for main context
  function isMainCtx(ctx: ShellContext): ctx is ShellContext & { kind: 'main' } {
    return ctx.kind === 'main';
  }

  // ── Initial State ──

  describe('initial shell state', () => {
    it('should start with main/active-servers context', () => {
      const state = store.getState();
      expect(state.contextStack).toHaveLength(1);
      expect(state.contextStack[0]!.kind).toBe('main');
      const top = state.contextStack[0]!;
      if (isMainCtx(top)) {
        expect(top.panel).toBe('active-servers');
      }
    });

    it('should have sidebar as initial focus region', () => {
      const state = store.getState();
      expect(state.focusRegion).toBe('sidebar');
    });
  });

  // ── pushContext ──

  describe('pushContext', () => {
    it('should push server context onto stack', () => {
      const ctx: ShellContext = { kind: 'server', serverId: createServerId('srv-1'), tab: 'management' };
      store.getState().pushContext(ctx);

      const state = store.getState();
      expect(state.contextStack).toHaveLength(2);
      expect(state.contextStack[1]!).toEqual(ctx);
    });

    it('should push main/archived context', () => {
      store.getState().pushContext({ kind: 'main', panel: 'archived' });
      const state = store.getState();
      expect(state.contextStack).toHaveLength(2);
      expect(state.contextStack[1]!.kind).toBe('main');
      const top = state.contextStack[1]!;
      if (isMainCtx(top)) {
        expect(top.panel).toBe('archived');
      }
    });
  });

  // ── popContext ──

  describe('popContext', () => {
    it('should pop top context when stack > 1', () => {
      store.getState().pushContext({ kind: 'server', serverId: createServerId('srv-1'), tab: 'management' });
      store.getState().popContext();

      const state = store.getState();
      expect(state.contextStack).toHaveLength(1);
      expect(state.contextStack[0]!.kind).toBe('main');
    });

    it('should be no-op when stack is 1', () => {
      store.getState().popContext();
      const state = store.getState();
      expect(state.contextStack).toHaveLength(1);
    });
  });

  // ── setFocus ──

  describe('setFocus', () => {
    it('should transition focus to main', () => {
      store.getState().setFocus('main');
      expect(store.getState().focusRegion).toBe('main');
    });

    it('should transition focus to modal', () => {
      store.getState().setFocus('modal');
      expect(store.getState().focusRegion).toBe('modal');
    });

    it('should transition back to sidebar', () => {
      store.getState().setFocus('main');
      store.getState().setFocus('sidebar');
      expect(store.getState().focusRegion).toBe('sidebar');
    });
  });

  // ── selectSidebarItem ──

  describe('selectSidebarItem', () => {
    it('selecting active-servers when already at active-servers does NOT push duplicate', () => {
      // Initial context is main/active-servers
      expect(store.getState().contextStack).toHaveLength(1);
      store.getState().selectSidebarItem('active-servers');
      expect(store.getState().contextStack).toHaveLength(1);
    });

    it('should push archived context when selecting archived (from active-servers)', () => {
      store.getState().selectSidebarItem('archived');
      expect(store.getState().contextStack).toHaveLength(2);
      const top = store.getState().contextStack[1]!;
      expect(top.kind).toBe('main');
      if (isMainCtx(top)) {
        expect(top.panel).toBe('archived');
      }
    });

    it('should push global-settings context when selecting settings', () => {
      store.getState().selectSidebarItem('global-settings');
      expect(store.getState().contextStack).toHaveLength(2);
      const top = store.getState().contextStack[1]!;
      if (isMainCtx(top)) {
        expect(top.panel).toBe('global-settings');
      }
    });

    it('should push archived context when selecting archived', () => {
      store.getState().selectSidebarItem('archived');
      const state = store.getState();
      const top = state.contextStack[1]!;
      if (isMainCtx(top)) {
        expect(top.panel).toBe('archived');
      }
    });

    it('should be no-op when not in main context', () => {
      // Push to server context first
      store.getState().pushContext({ kind: 'server', serverId: createServerId('srv-1'), tab: 'management' });
      // Try to select in server context — should be no-op
      store.getState().selectSidebarItem('active-servers');
      const state = store.getState();
      // Stack should still be 2 (server context pushed, not main)
      expect(state.contextStack).toHaveLength(2);
    });
  });

  // ── selectServerTab ──

  describe('selectServerTab', () => {
    it('should replace tab in server context', () => {
      store.getState().pushContext({ kind: 'server', serverId: createServerId('srv-1'), tab: 'management' });
      store.getState().selectServerTab('stats');

      const state = store.getState();
      const top = state.contextStack[state.contextStack.length - 1]!;
      expect(top.kind).toBe('server');
      if (top.kind === 'server') {
        expect(top.tab).toBe('stats');
      }
    });

    it('should be no-op when not in server context', () => {
      store.getState().selectServerTab('players');
      const state = store.getState();
      // Only the initial main context exists
      expect(state.contextStack).toHaveLength(1);
    });
  });

  // ── FocusRegion gating ──

  describe('focusRegion gating', () => {
    it('should track modal focus separately', () => {
      store.getState().setFocus('modal');
      store.getState().popContext(); // should still work even with modal
      const state = store.getState();
      expect(state.focusRegion).toBe('modal');
    });
  });
});
