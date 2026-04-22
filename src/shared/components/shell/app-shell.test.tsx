import { describe, it, expect, beforeEach } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';

import { AppShell } from '@/shared/components/shell/AppShell.tsx';
import { Router } from '@/app/routing/Router.tsx';
import { DashboardShellScreen } from '@/features/server-dashboard/components/DashboardShellScreen';
import { createNavigationStore } from '@/shared/infra/navigation-store.ts';
import type { NavigationStore } from '@/shared/infra/navigation-store.ts';
import { ServiceProvider } from '@/shared/hooks/use-services.tsx';

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
// Router always renders DashboardShellScreen (persistent shell).
// Legacy screen-stack routing tests have been removed.

describe('Router', () => {
  let navStore: NavigationStore;

  beforeEach(() => {
    navStore = createNavigationStore();
  });

  function renderDashboard(navStoreOverride?: NavigationStore) {
    const store = navStoreOverride ?? navStore;
    return render(
      React.createElement(
        ServiceProvider,
        { services: createMockServices() },
        React.createElement(DashboardShellScreen, { navStore: store }),
      ),
    );
  }

  it('should render main menu view via shell', () => {
    const { lastFrame } = renderDashboard();
    const frame = lastFrame();
    expect(frame).toContain('Create New Server');
  });

  it('should render archived servers view via shell', () => {
    navStore.getState().pushContext({ kind: 'main', panel: 'archived' });
    const { lastFrame } = renderDashboard(navStore);
    const frame = lastFrame();
    expect(frame).toContain('Archived Servers');
  });

  it('should render settings view via shell', () => {
    navStore.getState().pushContext({ kind: 'main', panel: 'global-settings' });
    const { lastFrame } = renderDashboard(navStore);
    const frame = lastFrame();
    // GlobalSettingsPanel renders language selection
    expect(frame).toContain('Language');
  });
});
