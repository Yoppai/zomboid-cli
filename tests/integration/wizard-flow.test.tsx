import { expect, test, describe, afterEach, vi } from 'bun:test';
import React from 'react';
import { SetupWizard } from '@/presentation/views/SetupWizard.tsx';
import { createNavigationStore } from '@/presentation/store/navigation-store.ts';
import { createWizardStore } from '@/presentation/store/wizard-store.ts';
import { ServiceProvider } from '@/presentation/hooks/use-services.tsx';
import { render } from 'ink-testing-library';

describe('Integration: Wizard Flow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  async function flush(ms = 50): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  test('completes the full wizard flow and triggers deploy', async () => {
    const navStore = createNavigationStore();
    const wizardStore = createWizardStore();
    wizardStore.getState().setServerName('my-server');

    // Inline cloudProvider mock (avoids real gcloud spawnFn issue)
    // deploy and latency come from createMockServices
    const servicesMock = {
      deploy: {
        deploy: vi.fn().mockResolvedValue({ id: 'new-srv-1', status: 'provisioning' }),
      },
      latency: {
        measureAllRegions: vi.fn().mockResolvedValue([
          { region: 'us-east1', zone: 'us-east1-b', latencyMs: 45 },
          { region: 'europe-west1', zone: 'europe-west1-d', latencyMs: 120 },
        ]),
      },
      cloudProvider: {
        verifyAuth: vi.fn().mockResolvedValue(true),
        listProjects: vi.fn().mockResolvedValue([{ id: 'proj-123', name: 'My Project' }]),
        enableApis: vi.fn().mockResolvedValue(undefined),
      },
      inventory: {},
      rcon: {},
      stats: {},
      backup: {},
      updateFlow: {},
      scheduler: {},
      archive: {},
      notificationStore: { addNotification: vi.fn(), removeNotification: vi.fn(), clear: vi.fn(), notifications: [] },
    };

    const { stdin, lastFrame, unmount } = render(
      <ServiceProvider services={servicesMock as any}>
        <SetupWizard navigationStore={navStore} wizardStore={wizardStore} />
      </ServiceProvider>,
    );

    try {
      // Step 1: Provider
      expect(lastFrame()).toContain('Select Cloud Provider');
      stdin.write('\r');
      await flush(60);

      // Step 2: Auth & Project — wait for mock verifyAuth + listProjects
      await flush(80);
      expect(lastFrame()).toContain('My Project (proj-123)');
      stdin.write('\r');
      await flush(60);

      expect(servicesMock.cloudProvider.enableApis).toHaveBeenCalledWith('proj-123');

      // Step 3: Region
      await flush(60);
      expect(lastFrame()).toContain('us-east1');
      stdin.write('\r');
      await flush(60);

      // Step 4: Instance
      expect(lastFrame()).toContain('Select Instance Type');
      stdin.write('\r');
      await flush(60);

      // Step 5: Confirm & Deploy
      expect(lastFrame()).toContain('Confirm Deployment');
      expect(lastFrame()).toContain('Provider: gcp');
      expect(lastFrame()).toContain('Project: proj-123');
      expect(lastFrame()).toContain('Region: us-east1');

      // Submit deploy confirmation
      stdin.write('\r');
      await flush(80);

      // Deploy path includes async uniqueness validation + deploy call
      expect(wizardStore.getState().step).toBe(1);
      expect(servicesMock.deploy.deploy).toHaveBeenCalled();

      const deployCall = servicesMock.deploy.deploy.mock.calls[0]?.[0];
      expect(deployCall).toBeDefined();
      expect(deployCall.rconPassword).toMatch(/^[a-zA-Z0-9]{32}$/);
      expect(deployCall.sshPrivateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(deployCall.sshPublicKey).toContain('ssh-ed25519');
    } finally {
      unmount();
    }
  });

  test('wizard calls cloudProvider.verifyAuth before listing projects', async () => {
    const navStore = createNavigationStore();
    const wizardStore = createWizardStore();
    wizardStore.getState().setServerName('test-server');

    const verifyAuthSpy = vi.fn().mockResolvedValue(true);
    const listProjectsSpy = vi.fn().mockResolvedValue([{ id: 'proj-x', name: 'Test Project' }]);

    const servicesMock = {
      deploy: { deploy: vi.fn() },
      latency: { measureAllRegions: vi.fn().mockResolvedValue([]) },
      cloudProvider: {
        verifyAuth: verifyAuthSpy,
        listProjects: listProjectsSpy,
      },
      inventory: {},
      rcon: {},
      stats: {},
      backup: {},
      updateFlow: {},
      scheduler: {},
      archive: {},
      notificationStore: { addNotification: vi.fn(), removeNotification: vi.fn(), clear: vi.fn(), notifications: [] },
    };

    const { stdin, lastFrame, unmount } = render(
      <ServiceProvider services={servicesMock as any}>
        <SetupWizard navigationStore={navStore} wizardStore={wizardStore} />
      </ServiceProvider>,
    );

    try {
      // Provider step: select GCP
      expect(lastFrame()).toContain('Select Cloud Provider');
      stdin.write('\r');
      await flush(80);

      // verifyAuth should have been called before listProjects
      expect(verifyAuthSpy).toHaveBeenCalled();
      expect(listProjectsSpy).toHaveBeenCalled();
    } finally {
      unmount();
    }
  });
});
