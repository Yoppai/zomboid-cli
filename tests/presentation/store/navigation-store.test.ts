import { describe, it, expect, beforeEach } from 'bun:test';

// Production code that does NOT exist yet — guarantees RED
import {
  createNavigationStore,
  type NavigationStore,
  type ScreenName,
  type ScreenEntry,
} from '@/presentation/store/navigation-store.ts';

describe('NavigationStore', () => {
  let store: NavigationStore;

  beforeEach(() => {
    store = createNavigationStore();
  });

  // ── Initial State ──

  describe('initial state', () => {
    it('should start with main-menu as the only screen in the stack', () => {
      const state = store.getState();
      expect(state.stack).toHaveLength(1);
      expect(state.stack[0]!.screen).toBe('main-menu');
    });

    it('should report current as main-menu', () => {
      const state = store.getState();
      expect(state.current.screen).toBe('main-menu');
    });

    it('should not be able to go back from initial state', () => {
      const state = store.getState();
      expect(state.canGoBack).toBe(false);
    });
  });

  // ── push ──

  describe('push', () => {
    it('should add a screen to the stack', () => {
      store.getState().push('setup-wizard');
      const state = store.getState();
      expect(state.stack).toHaveLength(2);
      expect(state.current.screen).toBe('setup-wizard');
    });

    it('should push with params', () => {
      store.getState().push('server-dashboard', { serverId: 'abc-123' });
      const state = store.getState();
      expect(state.current.screen).toBe('server-dashboard');
      expect(state.current.params).toEqual({ serverId: 'abc-123' });
    });

    it('should enable canGoBack after push', () => {
      store.getState().push('settings');
      expect(store.getState().canGoBack).toBe(true);
    });

    it('should support deep navigation (3+ screens)', () => {
      store.getState().push('setup-wizard');
      store.getState().push('server-dashboard', { serverId: 'x' });
      const state = store.getState();
      expect(state.stack).toHaveLength(3);
      expect(state.current.screen).toBe('server-dashboard');
      expect(state.canGoBack).toBe(true);
    });
  });

  // ── pop ──

  describe('pop', () => {
    it('should remove the top screen from the stack', () => {
      store.getState().push('setup-wizard');
      store.getState().pop();
      const state = store.getState();
      expect(state.stack).toHaveLength(1);
      expect(state.current.screen).toBe('main-menu');
    });

    it('should be a no-op when only main-menu remains', () => {
      store.getState().pop();
      const state = store.getState();
      expect(state.stack).toHaveLength(1);
      expect(state.current.screen).toBe('main-menu');
    });

    it('should navigate back through multiple screens', () => {
      store.getState().push('setup-wizard');
      store.getState().push('server-dashboard', { serverId: 'x' });
      store.getState().pop();
      expect(store.getState().current.screen).toBe('setup-wizard');
      store.getState().pop();
      expect(store.getState().current.screen).toBe('main-menu');
    });

    it('should update canGoBack correctly after pop', () => {
      store.getState().push('settings');
      expect(store.getState().canGoBack).toBe(true);
      store.getState().pop();
      expect(store.getState().canGoBack).toBe(false);
    });
  });

  // ── reset ──

  describe('reset', () => {
    it('should clear stack to only main-menu', () => {
      store.getState().push('setup-wizard');
      store.getState().push('server-dashboard', { serverId: 'y' });
      store.getState().push('settings');
      store.getState().reset();
      const state = store.getState();
      expect(state.stack).toHaveLength(1);
      expect(state.current.screen).toBe('main-menu');
      expect(state.canGoBack).toBe(false);
    });

    it('should be safe to call from initial state', () => {
      store.getState().reset();
      const state = store.getState();
      expect(state.stack).toHaveLength(1);
      expect(state.current.screen).toBe('main-menu');
    });
  });
});
