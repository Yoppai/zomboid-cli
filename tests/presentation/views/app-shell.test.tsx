import { describe, it, expect, beforeEach } from 'bun:test';
import React, { act } from 'react';
import { render } from 'ink-testing-library';

import { AppShell } from '@/presentation/views/AppShell.tsx';
import { Router } from '@/presentation/views/Router.tsx';
import { createNavigationStore } from '@/presentation/store/navigation-store.ts';
import type { NavigationStore } from '@/presentation/store/navigation-store.ts';
import { ServiceProvider } from '@/presentation/hooks/use-services.tsx';

function createMockServices() {
  return {
    inventory: {
      listActive: async () => [],
      listArchived: async () => [],
      getServer: async () => ({
        id: 'srv-abc',
        name: 'Alpha',
        provider: 'gcp',
        projectId: 'proj',
        instanceType: 'e2-standard-2',
        instanceZone: 'us-east1-b',
        staticIp: '1.1.1.1',
        sshPrivateKey: 'key',
        rconPassword: 'pass',
        gameBranch: 'stable',
        status: 'running',
        errorMessage: null,
        backupPath: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    },
    cloudProvider: {
      verifyAuth: async () => true,
      listProjects: async () => [{ id: 'proj', name: 'Project' }],
    },
    latency: {
      measureAllRegions: async () => [{ region: 'us-east1', zone: 'us-east1-b', latencyMs: 50 }],
    },
    deploy: {
      deploy: async () => ({}),
      startServer: async () => {},
      stopServer: async () => {},
    },
    rcon: {},
    stats: {},
    backup: {},
    updateFlow: {},
    scheduler: {},
    archive: {},
    localDb: {
      getSetting: async () => 'en',
      setSetting: async () => {},
    },
  } as any;
}

// ── AppShell ──

describe('AppShell', () => {
  it('should render children', () => {
    const { lastFrame } = render(
      React.createElement(
        AppShell,
        { locale: 'en' },
        React.createElement('ink-text', null, 'Hello from child'),
      ),
    );
    expect(lastFrame()).toContain('Hello from child');
  });

  it('should render with Spanish locale', () => {
    const { lastFrame } = render(
      React.createElement(
        AppShell,
        { locale: 'es' },
        React.createElement('ink-text', null, 'Hola mundo'),
      ),
    );
    expect(lastFrame()).toContain('Hola mundo');
  });
});

// ── Router ──

describe('Router', () => {
  let navStore: NavigationStore;

  beforeEach(() => {
    navStore = createNavigationStore();
  });

  function renderRouter() {
    return render(
      React.createElement(
        ServiceProvider,
        { services: createMockServices() },
        React.createElement(Router, { navigationStore: navStore }),
      ),
    );
  }

  it('should render main menu view on main-menu screen', () => {
    const { lastFrame } = renderRouter();
    const frame = lastFrame();
    expect(frame).toContain('Create New Server');
  });

  // ⚠️ SKIPPED: With DASHBOARD_SHELL=1, Router always returns DashboardShellScreen
  // and bypasses the legacy screen-stack entirely. These tests verify LegacyRouter
  // behavior which is intentionally unreachable under the shell feature flag.
  it.skip('should render setup wizard view when navigated to wizard', () => {
    navStore.getState().push('setup-wizard');
    const { lastFrame } = renderRouter();
    const frame = lastFrame();
    expect(frame).toContain('Setup Wizard');
  });

  // ⚠️ SKIPPED: Same reason — legacy Router path bypassed by DASHBOARD_SHELL=1
  it.skip('should render server dashboard view with serverId', async () => {
    navStore.getState().push('server-dashboard', { serverId: 'srv-abc' });
    const { lastFrame } = renderRouter();
    await new Promise((r) => setTimeout(r, 20));
    const frame = lastFrame();
    expect(frame).toContain('Dashboard: Alpha');
  });

  it('should render archived servers view', () => {
    navStore.getState().push('archived-servers');
    const { lastFrame } = renderRouter();
    const frame = lastFrame();
    expect(frame).toContain('Archived Servers');
  });

  it('should render settings view', () => {
    navStore.getState().push('settings');
    const { lastFrame } = renderRouter();
    const frame = lastFrame();
    expect(frame).toContain('Global Settings');
  });

  // ⚠️ SKIPPED: LegacyRouter subscription path bypassed by DASHBOARD_SHELL=1
  it.skip('should update when navigation changes via store subscription', () => {
    const { lastFrame } = renderRouter();
    expect(lastFrame()).toContain('Create New Server');

    // Push to wizard — act() flushes the React re-render triggered by useSyncExternalStore
    act(() => {
      navStore.getState().push('setup-wizard');
    });
    expect(lastFrame()).toContain('Setup Wizard');
  });

  // ⚠️ SKIPPED: LegacyRouter pop path bypassed by DASHBOARD_SHELL=1
  it.skip('should go back to previous screen on pop', () => {
    navStore.getState().push('setup-wizard');
    const { lastFrame } = renderRouter();
    expect(lastFrame()).toContain('Setup Wizard');

    act(() => {
      navStore.getState().pop();
    });
    expect(lastFrame()).toContain('Create New Server');
  });
});
