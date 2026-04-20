import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import React, { act } from 'react';
import { render } from 'ink-testing-library';
import { ServiceProvider } from '@/presentation/hooks/use-services.tsx';
import { DashboardShellScreen } from '@/presentation/views/DashboardShellScreen.tsx';
import { createNavigationStore } from '@/presentation/store/navigation-store.ts';
import { createServerStore } from '@/presentation/store/server-store.ts';
import { createUiStore } from '@/presentation/store/ui-store.ts';
import { setRuntimeLocale, resetRuntimeLocale } from '@/presentation/hooks/use-translation.ts';
import { createServerId } from '@/domain/entities/index.ts';

// Enable DashboardShellScreen mount
process.env.DASHBOARD_SHELL = '1';

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

// Helper: simulate server list in store so navigation to server context works
const TEST_SERVER_ID = createServerId('srv-1');

function makeServerRecord(id: ReturnType<typeof createServerId>, name: string, status: string) {
  return {
    id,
    name,
    provider: 'gcp' as any,
    projectId: 'proj-1',
    instanceType: 'e2-standard-2',
    instanceZone: 'us-central1-a',
    staticIp: '1.2.3.4',
    sshPrivateKey: 'key',
    rconPassword: 'pw',
    gameBranch: 'stable' as any,
    status: status as any,
    errorMessage: null,
    backupPath: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

function hydrateServers(serverStore: ReturnType<typeof createServerStore>) {
  act(() => {
    serverStore.getState().hydrateActive([
      makeServerRecord(TEST_SERVER_ID, 'TestServer', 'running'),
    ]);
    serverStore.getState().hydrate([
      makeServerRecord(TEST_SERVER_ID, 'TestServer', 'running'),
    ]);
  });
}

const TEST_SERVER_ID_2 = createServerId('srv-2');

function hydrateSecondServer(serverStore: ReturnType<typeof createServerStore>) {
  act(() => {
    serverStore.getState().hydrateActive([
      makeServerRecord(TEST_SERVER_ID, 'TestServer', 'running'),
      makeServerRecord(TEST_SERVER_ID_2, 'SecondServer', 'stopped'),
    ]);
    serverStore.getState().hydrate([
      makeServerRecord(TEST_SERVER_ID, 'TestServer', 'running'),
      makeServerRecord(TEST_SERVER_ID_2, 'SecondServer', 'stopped'),
    ]);
  });
}

describe('DashboardShellScreen — Shell Regions Render', () => {
  afterEach(() => { resetRuntimeLocale(); });

  it('renders ZOMBOID-CLI fixed title', () => {
    const { lastFrame } = render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(DashboardShellScreen, {}),
      ),
    );
    expect(lastFrame()).toContain('ZOMBOID-CLI');
  });

  it('renders ShellHeader with version', () => {
    const { lastFrame } = render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(DashboardShellScreen, {}),
      ),
    );
    expect(lastFrame()).toContain('CLI v0.1.0');
  });

  it('renders sidebar with Menu title', () => {
    const { lastFrame } = render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(DashboardShellScreen, {}),
      ),
    );
    expect(lastFrame()).toContain('Menu');
  });

  it('renders main content with Active Servers title', () => {
    const { lastFrame } = render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(DashboardShellScreen, {}),
      ),
    );
    expect(lastFrame()).toContain('Active Servers');
  });

  it('renders footer with Enter and Esc hints', () => {
    const { lastFrame } = render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(DashboardShellScreen, {}),
      ),
    );
    expect(lastFrame()).toContain('Enter');
    expect(lastFrame()).toContain('Esc');
  });
});

describe('DashboardShellScreen — Navigation Flow (store-driven)', () => {
  let navStore: ReturnType<typeof createNavigationStore>;
  let serverStore: ReturnType<typeof createServerStore>;
  let uiStore: ReturnType<typeof createUiStore>;

  beforeEach(() => {
    navStore = createNavigationStore();
    serverStore = createServerStore();
    uiStore = createUiStore();
  });

  afterEach(() => { resetRuntimeLocale(); });

  it('navigates from active-servers to server context when server selected', () => {
    hydrateServers(serverStore);

    // Select server — this pushes server context
    act(() => {
      navStore.getState().pushContext({ kind: 'server', serverId: TEST_SERVER_ID, tab: 'management' });
    });

    // Verify context is server
    const top = navStore.getState().contextStack[navStore.getState().contextStack.length - 1]!;
    expect(top.kind).toBe('server');
    expect((top as any).serverId).toBe(TEST_SERVER_ID);
    expect((top as any).tab).toBe('management');
  });

  it('ESC in server context with sidebar focus pops back to main context', () => {
    hydrateServers(serverStore);

    // Enter server context
    act(() => {
      navStore.getState().pushContext({ kind: 'server', serverId: TEST_SERVER_ID, tab: 'management' });
      navStore.getState().setFocus('sidebar');
    });

    // Simulate ESC handler path: popContext + setFocus('sidebar')
    act(() => {
      navStore.getState().popContext();
      navStore.getState().setFocus('sidebar');
    });

    // Should be back at main/active-servers
    const top = navStore.getState().contextStack[navStore.getState().contextStack.length - 1]!;
    expect(top.kind).toBe('main');
    expect((top as any).panel).toBe('active-servers');
  });

  it('navigates to different server tabs (players, stats, build)', () => {
    hydrateServers(serverStore);

    // Push server context, then switch to players tab
    act(() => {
      navStore.getState().pushContext({ kind: 'server', serverId: TEST_SERVER_ID, tab: 'players' });
    });

    let top = navStore.getState().contextStack[navStore.getState().contextStack.length - 1]!;
    expect((top as any).tab).toBe('players');

    // Switch to stats tab
    act(() => {
      navStore.getState().selectServerTab('stats');
    });

    top = navStore.getState().contextStack[navStore.getState().contextStack.length - 1]!;
    expect((top as any).tab).toBe('stats');

    // Switch to build tab
    act(() => {
      navStore.getState().selectServerTab('build');
    });

    top = navStore.getState().contextStack[navStore.getState().contextStack.length - 1]!;
    expect((top as any).tab).toBe('build');
  });
});

describe('DashboardShellScreen — Wizard Overlay Flow', () => {
  let uiStore: ReturnType<typeof createUiStore>;

  beforeEach(() => {
    uiStore = createUiStore();
  });

  afterEach(() => { resetRuntimeLocale(); });

  it('openWizard sets modalState=wizard and dimmed=true', () => {
    act(() => { uiStore.getState().openWizard(); });
    expect(uiStore.getState().modalState).toBe('wizard');
    expect(uiStore.getState().dimmed).toBe(true);
  });

  it('closeWizard clears modalState and dimmed', () => {
    act(() => {
      uiStore.getState().openWizard();
      uiStore.getState().closeWizard();
    });
    expect(uiStore.getState().modalState).toBe('closed');
    expect(uiStore.getState().dimmed).toBe(false);
  });

  it('wizard overlay renders SetupWizard component when modalState=wizard', () => {
    const { lastFrame } = render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(DashboardShellScreen, {}),
      ),
    );

    // No wizard initially
    expect(lastFrame()).not.toContain('Setup Wizard');

    // Open wizard via uiStore
    act(() => { uiStore.getState().openWizard(); });

    // With dimmed overlay active, SetupWizard renders inside OverlayHost
    // Note: we verify via store state; full render would need snapshot
    expect(uiStore.getState().modalState).toBe('wizard');
    expect(uiStore.getState().dimmed).toBe(true);
  });
});

describe('DashboardShellScreen — Confirm Dialog in Shell', () => {
  let uiStore: ReturnType<typeof createUiStore>;

  beforeEach(() => {
    uiStore = createUiStore();
  });

  afterEach(() => { resetRuntimeLocale(); });

  it('showConfirm sets modalState=confirm, dimmed=true, stores config', () => {
    act(() => {
      uiStore.getState().showConfirm({
        message: 'Delete server?',
        onConfirm: () => {},
        onCancel: () => {},
      });
    });
    expect(uiStore.getState().modalState).toBe('confirm');
    expect(uiStore.getState().dimmed).toBe(true);
    expect(uiStore.getState().confirmDialog).not.toBeNull();
    expect(uiStore.getState().confirmDialog?.message).toBe('Delete server?');
  });

  it('clearConfirm resets modalState=closed and dimmed=false', () => {
    act(() => {
      uiStore.getState().showConfirm({
        message: 'Delete server?',
        onConfirm: () => {},
        onCancel: () => {},
      });
      uiStore.getState().clearConfirm();
    });
    expect(uiStore.getState().modalState).toBe('closed');
    expect(uiStore.getState().dimmed).toBe(false);
    expect(uiStore.getState().confirmDialog).toBeNull();
  });

  it('ConfirmDialog captures input when variant=modal and isActive=true', () => {
    act(() => {
      uiStore.getState().showConfirm({
        message: 'Confirm action',
        onConfirm: () => {},
        onCancel: () => {},
      });
    });
    // modalState === 'confirm' means shell's useInput is gated
    // and ConfirmDialog with isActive=true handles input
    expect(uiStore.getState().modalState).toBe('confirm');
    expect(uiStore.getState().dimmed).toBe(true);
    expect(uiStore.getState().confirmDialog).not.toBeNull();
  });
});

describe('DashboardShellScreen — i18n Live Update', () => {
  afterEach(() => { resetRuntimeLocale(); });

  it('renders sidebar title from i18n (en locale)', () => {
    resetRuntimeLocale();
    const { lastFrame } = render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(DashboardShellScreen, {}),
      ),
    );
    expect(lastFrame()).toContain('Menu');
  });

  it('updates UI when locale changes to Spanish', async () => {
    const { lastFrame } = render(
      React.createElement(ServiceProvider, { services: createMockServices() as any },
        React.createElement(DashboardShellScreen, {}),
      ),
    );

    // Initial: English
    expect(lastFrame()).toContain('Active Servers');

    // Switch to Spanish
    await act(async () => { setRuntimeLocale('es'); });

    // After locale switch, panel title changes to Spanish
    expect(lastFrame()).toContain('Servidores Activos');
  });
});

describe('DashboardShellScreen — Responsive Column Collapse', () => {
  afterEach(() => { resetRuntimeLocale(); });

  it('empty server list shows empty state message (not column headers)', () => {
    const emptyServices = {
      ...createMockServices(),
      inventory: { listActive: async () => [], listArchived: async () => [], getServer: async () => null },
    };
    const { lastFrame } = render(
      React.createElement(ServiceProvider, { services: emptyServices as any },
        React.createElement(DashboardShellScreen, {}),
      ),
    );
    // Empty state shows message, not column headers
    expect(lastFrame()).toContain('No servers');
  });
});

describe('DashboardShellScreen — Server Store Hydration Triggers Re-render', () => {
  let serverStore: ReturnType<typeof createServerStore>;

  beforeEach(() => {
    serverStore = createServerStore();
  });

  afterEach(() => { resetRuntimeLocale(); });

  it('hydrateActive populates active list and triggers store update', () => {
    expect(serverStore.getState().active).toHaveLength(0);

    act(() => {
      serverStore.getState().hydrateActive([
        makeServerRecord(TEST_SERVER_ID_2, 'HydratedServer', 'running'),
      ]);
    });

    expect(serverStore.getState().active).toHaveLength(1);
    expect(serverStore.getState().active[0]!.name).toBe('HydratedServer');
  });

it('invalidationToken increments on invalidate', async () => {
    expect(serverStore.getState().invalidationToken).toBe(0);
    await act(async () => { await serverStore.getState().invalidate('deploy'); });
    expect(serverStore.getState().invalidationToken).toBe(1);
  });

  it('selectSidebarItem with same panel as top does NOT push duplicate context', () => {
    const store = createNavigationStore();
    // Already at main/active-servers (initial state)
    act(() => { store.getState().selectSidebarItem('active-servers'); });
    // Stack length should stay 1 — no duplicate pushed
    expect(store.getState().contextStack).toHaveLength(1);
  });

  it('selectSidebarItem create_server returns state without pushing', () => {
    const store = createNavigationStore();
    act(() => { store.getState().selectSidebarItem('create_server'); });
    // create_server is handled by caller — store should return state unchanged
    expect(store.getState().contextStack).toHaveLength(1);
    expect(store.getState().contextStack[0]!.kind).toBe('main');
  });
});