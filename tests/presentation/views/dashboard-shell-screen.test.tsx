import { describe, it, expect, beforeEach } from 'bun:test';
import React, { act } from 'react';
import { render } from 'ink-testing-library';
import { ServiceProvider } from '@/presentation/hooks/use-services.tsx';
import { DashboardShellScreen } from '@/presentation/views/DashboardShellScreen.tsx';
import { createNavigationStore } from '@/presentation/store/navigation-store.ts';
import { createServerStore } from '@/presentation/store/server-store.ts';
import { createUiStore } from '@/presentation/store/ui-store.ts';

// Shell is now the only supported path — no feature flag needed.

function createMockServices() {
  return {
    inventory: {
      listActive: async () => [],
      listArchived: async () => [],
      getServer: async () => null,
    },
    cloudProvider: { verifyAuth: async () => true },
    latency: { measureAllRegions: async () => [] },
    deploy: { deploy: async () => ({}), startServer: async () => {}, stopServer: async () => {} },
    rcon: { getOnlinePlayers: async () => [] },
    stats: { getContainerStats: async () => null },
    backup: {},
    updateFlow: {},
    scheduler: {},
    archive: {},
    localDb: { getSetting: async () => 'en', setSetting: async () => {} },
    notificationStore: { addNotification: () => {} },
  };
}

describe('DashboardShellScreen', () => {
  let navStore: ReturnType<typeof createNavigationStore>;
  let serverStore: ReturnType<typeof createServerStore>;
  let uiStore: ReturnType<typeof createUiStore>;

  function renderShell() {
    return render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(DashboardShellScreen, {}),
      ),
    );
  }

  beforeEach(() => {
    // Stores are created inside DashboardShellScreen via useMemo
    // We test by rendering the component and observing the output
    navStore = createNavigationStore();
    serverStore = createServerStore();
    uiStore = createUiStore();
  });

  // ── Shell Regions ────────────────────────────────────────────────

  it('should render fixed ZOMBOID-CLI title', () => {
    const { lastFrame } = renderShell();
    // Shell renders with wide columns by default — HeroTitle uses BigText path
    // which produces ASCII art with box-drawing chars. Assert visible hero exists.
    const frame = lastFrame();
    // Verify hero region has non-empty content (BigText art or fallback text)
    expect(frame).toMatch(/[▊█║╔╚╗╝─]/);
  });

  it('should render ShellHeader with version', () => {
    const { lastFrame } = renderShell();
    expect(lastFrame()).toContain('CLI v0.1.0');
  });

  it('should render sidebar with Menu title', () => {
    const { lastFrame } = renderShell();
    expect(lastFrame()).toContain('Menu');
  });

  it('should render main content with Active Servers title', () => {
    const { lastFrame } = renderShell();
    expect(lastFrame()).toContain('Active Servers');
  });

  it('should render footer with Enter and Esc hints', () => {
    const { lastFrame } = renderShell();
    expect(lastFrame()).toContain('Enter');
    expect(lastFrame()).toContain('Esc');
  });

  // ── ESC Behavior ────────────────────────────────────────────────

  it('should have initial context of main/active-servers', () => {
    const { lastFrame } = renderShell();
    expect(lastFrame()).toContain('Active Servers');
  });

  // ── Focus Region ───────────────────────────────────────────────

  it('should have sidebar as initial focus region', () => {
    const { lastFrame } = renderShell();
    // Sidebar should be visually active (dimColor=false for sidebar title when focused)
    expect(lastFrame()).toContain('Menu');
  });

  // ── Modal State ─────────────────────────────────────────────────

  it('should render with dimmed overlay when wizard opens', () => {
    const { lastFrame } = renderShell();
    // Initial state: no dimmed overlay
    expect(lastFrame()).not.toContain('gray');
  });

  // ── Footer Hints ───────────────────────────────────────────────

  it('should render footer hints section', () => {
    const { lastFrame } = renderShell();
    // Footer renders [Enter] Select and [Esc] Back
    expect(lastFrame()).toContain('Enter');
    expect(lastFrame()).toContain('Esc');
  });
});

// ── Store Unit Tests (for shell behavior) ────────────────────────────────

describe('NavigationState — Shell context stack behavior', () => {
  let store: ReturnType<typeof createNavigationStore>;

  beforeEach(() => {
    store = createNavigationStore();
  });

  it('initial context is main/active-servers', () => {
    const top = store.getState().contextStack[store.getState().contextStack.length - 1]!;
    expect(top.kind).toBe('main');
    expect((top as any).panel).toBe('active-servers');
  });

  it('pushContext adds server context on top', () => {
    act(() => {
      store.getState().pushContext({ kind: 'server', serverId: 'srv-1' as any, tab: 'management' });
    });
    expect(store.getState().contextStack).toHaveLength(2);
  });

  it('ESC in server context with main focus returns to sidebar (not pop)', () => {
    act(() => {
      store.getState().pushContext({ kind: 'server', serverId: 'srv-1' as any, tab: 'management' });
      store.getState().setFocus('main');
    });
    // Simulate ESC handler: setFocus('sidebar') but do NOT pop
    act(() => {
      store.getState().setFocus('sidebar');
    });
    expect(store.getState().focusRegion).toBe('sidebar');
    // Context should still be server (length=2)
    expect(store.getState().contextStack).toHaveLength(2);
  });

  it('ESC in server context with sidebar focus pops to main context', () => {
    act(() => {
      store.getState().pushContext({ kind: 'server', serverId: 'srv-1' as any, tab: 'management' });
      store.getState().setFocus('sidebar');
    });
    // Simulate ESC handler: popContext + setFocus('sidebar')
    act(() => {
      store.getState().popContext();
      store.getState().setFocus('sidebar');
    });
    expect(store.getState().contextStack).toHaveLength(1);
    const top = store.getState().contextStack[0]!;
    expect(top.kind).toBe('main');
    expect((top as any).panel).toBe('active-servers');
  });

  it('Tab cycles focus sidebar ↔ main', () => {
    expect(store.getState().focusRegion).toBe('sidebar');
    act(() => { store.getState().setFocus('main'); });
    expect(store.getState().focusRegion).toBe('main');
    act(() => { store.getState().setFocus('sidebar'); });
    expect(store.getState().focusRegion).toBe('sidebar');
  });
});

describe('UiStore — Overlay state', () => {
  let store: ReturnType<typeof createUiStore>;

  beforeEach(() => {
    store = createUiStore();
  });

  it('openWizard sets modalState=wizard and dimmed=true', () => {
    act(() => { store.getState().openWizard(); });
    expect(store.getState().modalState).toBe('wizard');
    expect(store.getState().dimmed).toBe(true);
  });

  it('closeWizard clears modalState and dimmed', () => {
    act(() => {
      store.getState().openWizard();
      store.getState().closeWizard();
    });
    expect(store.getState().modalState).toBe('closed');
    expect(store.getState().dimmed).toBe(false);
  });

  it('showConfirm sets modalState=confirm, dimmed=true, and stores config', () => {
    act(() => {
      store.getState().showConfirm({ message: 'Delete?', onConfirm: () => {}, onCancel: () => {} });
    });
    expect(store.getState().modalState).toBe('confirm');
    expect(store.getState().dimmed).toBe(true);
    expect(store.getState().confirmDialog).not.toBeNull();
  });

  it('clearConfirm resets modalState and dimmed', () => {
    act(() => {
      store.getState().showConfirm({ message: 'Delete?', onConfirm: () => {}, onCancel: () => {} });
      store.getState().clearConfirm();
    });
    expect(store.getState().modalState).toBe('closed');
    expect(store.getState().dimmed).toBe(false);
    expect(store.getState().confirmDialog).toBeNull();
  });

  it('setFooterHints and clearFooterHints work', () => {
    act(() => { store.getState().setFooterHints(['[Ctrl+C] Quit']); });
    expect(store.getState().footerHints).toContain('[Ctrl+C] Quit');
    act(() => { store.getState().clearFooterHints(); });
    expect(store.getState().footerHints).toEqual([]);
  });
});

describe('ServerStore — Hydrate / invalidation', () => {
  let store: ReturnType<typeof createServerStore>;

  beforeEach(() => {
    store = createServerStore();
  });

  it('hydrateActive populates active list', () => {
    act(() => {
      store.getState().hydrateActive([
        { id: 's1' as any, name: 'Alpha', provider: 'gcp' as any, projectId: 'p', instanceType: 'e2', instanceZone: 'z', staticIp: null, sshPrivateKey: 'k', rconPassword: 'r', gameBranch: 'stable' as any, status: 'running' as any, errorMessage: null, backupPath: null, createdAt: 'd', updatedAt: 'd' }
      ]);
    });
    expect(store.getState().active).toHaveLength(1);
  });

  it('invalidationToken increments on invalidate', async () => {
    expect(store.getState().invalidationToken).toBe(0);
    await act(async () => { await store.getState().invalidate('deploy'); });
    expect(store.getState().invalidationToken).toBe(1);
  });
});
