import { describe, it, expect, beforeEach, vi } from 'bun:test';
import React, { act } from 'react';
import { render } from 'ink-testing-library';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

vi.mock('@/presentation/hooks/use-services.tsx', () => ({
  useServices: () => ({
    cloudProvider: {
      verifyAuth: vi.fn().mockResolvedValue(true),
      listProjects: vi.fn().mockResolvedValue([{ id: 'mock-proj', name: 'Mock' }])
    },
    latency: {
      measureAllRegions: vi.fn().mockResolvedValue([{ region: 'us-east1', zone: 'us-east1-b', latencyMs: 45 }])
    },
    deploy: {
      deploy: vi.fn().mockResolvedValue({ id: 'srv', status: 'provisioning' })
    }
  }),
  ServiceProvider: ({ children }: any) => <>{children}</>
}));

// Production code that does NOT exist yet — guarantees RED
import { SetupWizard } from '@/presentation/views/SetupWizard.tsx';
import { ProviderSelect } from '@/presentation/views/wizard-steps/ProviderSelect.tsx';
import { AuthProject } from '@/presentation/views/wizard-steps/AuthProject.tsx';
import { RegionSelect } from '@/presentation/views/wizard-steps/RegionSelect.tsx';
import { InstanceSelect } from '@/presentation/views/wizard-steps/InstanceSelect.tsx';
import { DeployConfirm } from '@/presentation/views/wizard-steps/DeployConfirm.tsx';

import { createWizardStore } from '@/presentation/store/wizard-store.ts';
import type { WizardStore } from '@/presentation/store/wizard-store.ts';
import { createNavigationStore } from '@/presentation/store/navigation-store.ts';
import type { NavigationStore } from '@/presentation/store/navigation-store.ts';
import { GCP_MACHINE_CATALOG } from '@/domain/entities/index.ts';
import type { RegionLatency, GameBranch } from '@/domain/entities/index.ts';

// ── SetupWizard (parent) ──

describe('SetupWizard', () => {
  let wizardStore: WizardStore;
  let navStore: NavigationStore;

  beforeEach(() => {
    wizardStore = createWizardStore();
    navStore = createNavigationStore();
  });

  it('should render Header with "Setup Wizard" title', async () => {
    const { lastFrame } = render(
      React.createElement(SetupWizard, {
        navigationStore: navStore,
        wizardStore,
      }),
    );
    expect(lastFrame()).toContain('Setup Wizard');
  });

  it('should render step indicator "Step 1 of 5" by default', async () => {
    const { lastFrame } = render(
      React.createElement(SetupWizard, {
        navigationStore: navStore,
        wizardStore,
      }),
    );
    expect(lastFrame()).toContain('Step 1 of 5');
  });

  it('should render ProviderSelect at step 1', async () => {
    const { lastFrame } = render(
      React.createElement(SetupWizard, {
        navigationStore: navStore,
        wizardStore,
      }),
    );
    // ProviderSelect shows GCP
    expect(lastFrame()).toContain('GCP');
  });

  it('should render step 2 content when wizardStore.step changes to 2', async () => {
    const { lastFrame } = render(
      React.createElement(SetupWizard, {
        navigationStore: navStore,
        wizardStore,
      }),
    );
    act(() => {
      wizardStore.getState().setStep(2);
    });
    expect(lastFrame()).toContain('Step 2 of 5');
  });

  it('should render step indicator "Step 3 of 5" at step 3', async () => {
    wizardStore.getState().setStep(3);
    const { lastFrame } = render(
      React.createElement(SetupWizard, {
        navigationStore: navStore,
        wizardStore,
      }),
    );
    expect(lastFrame()).toContain('Step 3 of 5');
  });

  it('should show ESC Cancel key hint', async () => {
    const { lastFrame } = render(
      React.createElement(SetupWizard, {
        navigationStore: navStore,
        wizardStore,
      }),
    );
    expect(lastFrame()).toContain('ESC');
    expect(lastFrame()).toContain('Cancel');
  });

  it('should call wizardStore.reset and navStore.pop on Escape', async () => {
    const { stdin, unmount } = render(
      React.createElement(SetupWizard, {
        navigationStore: navStore,
        wizardStore,
      }),
    );
    // Set some state first so we can verify reset
    act(() => {
      wizardStore.getState().setProvider('gcp');
      wizardStore.getState().setStep(3);
    });
    expect(wizardStore.getState().step).toBe(3);

    // Press Escape
    act(() => {
      stdin.write('\x1B');
    });
    await sleep(20);
    
    // Wait for useInput to process
    await new Promise((r) => setTimeout(r, 20));
    
    expect(wizardStore.getState().step).toBe(1);
    expect(wizardStore.getState().provider).toBeNull();
    unmount();
  });
});

// ── Step 1: ProviderSelect ──

describe('ProviderSelect', () => {
  let wizardStore: WizardStore;

  beforeEach(() => {
    wizardStore = createWizardStore();
  });

  it('should render 3 provider options', async () => {
    const { lastFrame } = render(
      React.createElement(ProviderSelect, { wizardStore }),
    );
    const frame = lastFrame();
    expect(frame).toContain('GCP');
    expect(frame).toContain('AWS');
    expect(frame).toContain('Azure');
  });

  it('should show "Coming Soon" for AWS and Azure', async () => {
    const { lastFrame } = render(
      React.createElement(ProviderSelect, { wizardStore }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Coming Soon');
  });

  it('should show GCP (Google Cloud) as enabled option', async () => {
    const { lastFrame } = render(
      React.createElement(ProviderSelect, { wizardStore }),
    );
    expect(lastFrame()).toContain('GCP (Google Cloud)');
  });

  it('should set provider to gcp and advance to step 2 on GCP select', async () => {
    const { stdin } = render(
      React.createElement(ProviderSelect, { wizardStore }),
    );
    // GCP is the first enabled item, press Enter to select
    act(() => {
      stdin.write('\r');
    });
    await sleep(20);

    expect(wizardStore.getState().provider).toBe('gcp');
    expect(wizardStore.getState().step).toBe(2);
  });
});

// ── Step 2: AuthProject ──

describe('AuthProject', () => {
  let wizardStore: WizardStore;

  beforeEach(() => {
    wizardStore = createWizardStore();
    wizardStore.getState().setProvider('gcp');
    wizardStore.getState().setStep(2);
  });

  it('should show spinner with "Checking GCP authentication..." initially', async () => {
    const { lastFrame } = render(
      React.createElement(AuthProject, {
        wizardStore,
        onVerifyAuth: () => new Promise<boolean>(() => {}), // never resolves
        onListProjects: () => Promise.resolve([]),
      }),
    );
    expect(lastFrame()).toContain('Checking GCP authentication');
  });

  it('should show error message when auth fails', async () => {
    let resolveAuth: (v: boolean) => void;
    const authPromise = new Promise<boolean>((r) => { resolveAuth = r; });

    const { lastFrame } = render(
      React.createElement(AuthProject, {
        wizardStore,
        onVerifyAuth: () => authPromise,
        onListProjects: () => Promise.resolve([]),
      }),
    );

    await act(async () => {
      resolveAuth!(false);
      await authPromise;
    });

    expect(lastFrame()).toContain('gcloud auth login');
  });

  it('should show project list when auth succeeds', async () => {
    const projects = [
      { id: 'proj-alpha', name: 'Alpha' },
      { id: 'proj-beta', name: 'Beta' },
    ];
    let resolveAuth: (v: boolean) => void;
    const authPromise = new Promise<boolean>((r) => { resolveAuth = r; });
    let resolveProjects: (v: { id: string; name: string }[]) => void;
    const projectsPromise = new Promise<{ id: string; name: string }[]>((r) => { resolveProjects = r; });

    const { lastFrame } = render(
      React.createElement(AuthProject, {
        wizardStore,
        onVerifyAuth: () => authPromise,
        onListProjects: () => projectsPromise,
      }),
    );

    await act(async () => {
      resolveAuth!(true);
      await authPromise;
    });

    await act(async () => {
      resolveProjects!(projects);
      await projectsPromise;
    });

    const frame = lastFrame() ?? '';
    expect(frame).toContain('proj-alpha');
    expect(frame).toContain('proj-beta');
  });

  it('should set project and advance to step 3 on project select', async () => {
    const projects = [{ id: 'proj-one', name: 'One' }];

    const { lastFrame, stdin } = render(
      React.createElement(AuthProject, {
        wizardStore,
        onVerifyAuth: () => Promise.resolve(true),
        onListProjects: () => Promise.resolve(projects),
      }),
    );

    // Wait for auth + projects to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(lastFrame()).toContain('proj-one');

    // Select the project
    act(() => {
      stdin.write('\r');
    });
    await sleep(20);

    expect(wizardStore.getState().projectId).toBe('proj-one');
    expect(wizardStore.getState().step).toBe(3);
  });

  it('should call onEnableApis before advancing to step 3', async () => {
    const onEnableApis = vi.fn().mockResolvedValue(undefined);
    const { stdin } = render(
      React.createElement(AuthProject, {
        wizardStore,
        onVerifyAuth: () => Promise.resolve(true),
        onListProjects: () => Promise.resolve([{ id: 'proj-enable', name: 'Enable APIs' }]),
        onEnableApis,
      } as any),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    act(() => {
      stdin.write('\r');
    });
    await sleep(20);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(onEnableApis).toHaveBeenCalledWith('proj-enable');
    expect(wizardStore.getState().projectId).toBe('proj-enable');
    expect(wizardStore.getState().step).toBe(3);
  });

  it('should show retry and back options when API enablement fails', async () => {
    const onEnableApis = vi
      .fn()
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValueOnce(undefined);

    const { stdin, lastFrame } = render(
      React.createElement(AuthProject, {
        wizardStore,
        onVerifyAuth: () => Promise.resolve(true),
        onListProjects: () => Promise.resolve([{ id: 'proj-fail', name: 'Fail APIs' }]),
        onEnableApis,
      } as any),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    act(() => {
      stdin.write('\r');
    });
    await sleep(20);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Retry');
    expect(frame).toContain('Back');

    // Retry selected by default
    act(() => {
      stdin.write('\r');
    });
    await sleep(20);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(onEnableApis).toHaveBeenCalledTimes(2);
    expect(wizardStore.getState().step).toBe(3);
  });
});

// ── Step 3: RegionSelect ──

describe('RegionSelect', () => {
  let wizardStore: WizardStore;

  beforeEach(() => {
    wizardStore = createWizardStore();
    wizardStore.getState().setProvider('gcp');
    wizardStore.getState().setProject('my-proj');
    wizardStore.getState().setStep(3);
  });

  it('should show spinner when latencies are empty', async () => {
    const { lastFrame } = render(
      React.createElement(RegionSelect, {
        wizardStore,
        latencies: [],
      }),
    );
    expect(lastFrame()).toContain('Measuring latency');
  });

  it('should show region list when latencies are provided', async () => {
    const latencies: RegionLatency[] = [
      { region: 'us-east1', zone: 'us-east1-b', latencyMs: 45 },
      { region: 'europe-west1', zone: 'europe-west1-b', latencyMs: 120 },
    ];

    const { lastFrame } = render(
      React.createElement(RegionSelect, {
        wizardStore,
        latencies,
      }),
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('us-east1');
    expect(frame).toContain('europe-west1');
  });

  it('should sort regions by latencyMs ascending', async () => {
    const latencies: RegionLatency[] = [
      { region: 'europe-west1', zone: 'europe-west1-b', latencyMs: 200 },
      { region: 'us-east1', zone: 'us-east1-b', latencyMs: 50 },
      { region: 'asia-east1', zone: 'asia-east1-a', latencyMs: 150 },
    ];

    const { lastFrame } = render(
      React.createElement(RegionSelect, {
        wizardStore,
        latencies,
      }),
    );

    const frame = lastFrame() ?? '';
    const usIdx = frame.indexOf('us-east1');
    const asiaIdx = frame.indexOf('asia-east1');
    const euIdx = frame.indexOf('europe-west1');
    expect(usIdx).toBeLessThan(asiaIdx);
    expect(asiaIdx).toBeLessThan(euIdx);
  });

  it('should set region/zone and advance to step 4 on select', async () => {
    const latencies: RegionLatency[] = [
      { region: 'us-east1', zone: 'us-east1-b', latencyMs: 45 },
    ];

    const { stdin } = render(
      React.createElement(RegionSelect, {
        wizardStore,
        latencies,
      }),
    );

    // Select first region
    act(() => {
      stdin.write('\r');
    });
    await sleep(20);

    expect(wizardStore.getState().region).toBe('us-east1');
    expect(wizardStore.getState().zone).toBe('us-east1-b');
    expect(wizardStore.getState().step).toBe(4);
  });
});

// ── Step 4: InstanceSelect ──

describe('InstanceSelect', () => {
  let wizardStore: WizardStore;

  beforeEach(() => {
    wizardStore = createWizardStore();
    wizardStore.getState().setStep(4);
  });

  it('should render all 3 machine tiers from GCP_MACHINE_CATALOG', async () => {
    const { lastFrame } = render(
      React.createElement(InstanceSelect, { wizardStore }),
    );

    const frame = lastFrame();
    // All three labels from the catalog
    expect(frame).toContain('Small Co-op');
    expect(frame).toContain('Community');
    expect(frame).toContain('Massive');
  });

  it('should show RAM and player info for each tier', async () => {
    const { lastFrame } = render(
      React.createElement(InstanceSelect, { wizardStore }),
    );

    const frame = lastFrame();
    expect(frame).toContain('8GB');
    expect(frame).toContain('6GB');
    expect(frame).toContain('1-8');
  });

  it('should set machineType and advance to step 5 on select', async () => {
    const { stdin } = render(
      React.createElement(InstanceSelect, { wizardStore }),
    );

    // Select first machine type (Small Co-op)
    act(() => {
      stdin.write('\r');
    });
    await sleep(20);

    const state = wizardStore.getState();
    expect(state.machineType).not.toBeNull();
    expect(state.machineType!.id).toBe('e2-standard-2');
    expect(state.step).toBe(5);
  });

  it('should set correct machineType when second option selected', async () => {
    const { stdin } = render(
      React.createElement(InstanceSelect, { wizardStore }),
    );

    // Navigate down once, then select
    act(() => {
      stdin.write('\x1B[B'); // down arrow
    });
    act(() => {
      stdin.write('\r');
    });
    await sleep(20);

    const state = wizardStore.getState();
    expect(state.machineType!.id).toBe('n2-standard-4');
    expect(state.step).toBe(5);
  });

  it('should render Dynamic Catalog option', async () => {
    const { lastFrame } = render(
      React.createElement(InstanceSelect, {
        wizardStore,
        onLoadDynamicCatalog: async () => [],
      } as any),
    );

    expect(lastFrame()).toContain('Dynamic Catalog');
  });

  it('should reject invalid manual machine type from dynamic catalog', async () => {
    wizardStore.getState().setProject('proj-1');
    wizardStore.getState().setRegion('us-east1', 'us-east1-b');

    const { stdin, lastFrame } = render(
      React.createElement(InstanceSelect, {
        wizardStore,
        onLoadDynamicCatalog: async () => [
          {
            id: 'n2-standard-8',
            label: 'n2-standard-8',
            totalRamGb: 32,
            serverMemoryGb: 26,
            maxPlayers: 'dynamic',
          },
        ],
      } as any),
    );

    // Move to dynamic option (last item)
    act(() => {
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\r');
    });
    await sleep(20);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    act(() => {
      stdin.write('does-not-exist');
      stdin.write('\r');
    });
    await sleep(20);

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Machine type not found in region us-east1');
    expect(wizardStore.getState().step).toBe(4);
  });

  it('should accept valid manual machine type from dynamic catalog', async () => {
    wizardStore.getState().setProject('proj-1');
    wizardStore.getState().setRegion('us-east1', 'us-east1-b');

    const { stdin, lastFrame } = render(
      React.createElement(InstanceSelect, {
        wizardStore,
        onLoadDynamicCatalog: async () => [
          {
            id: 'n2-standard-8',
            label: 'n2-standard-8',
            totalRamGb: 32,
            serverMemoryGb: 26,
            maxPlayers: 'dynamic',
          },
        ],
      } as any),
    );

    act(() => {
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\r');
    });
    await sleep(20);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(lastFrame()).toContain('Machine Type');

    act(() => {
      stdin.write('n2-standard-8');
    });
    await sleep(20);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    act(() => {
      stdin.write('\r');
    });
    await sleep(20);

    expect(wizardStore.getState().machineType?.id).toBe('n2-standard-8');
    expect(wizardStore.getState().step).toBe(5);
  });
});

// ── Step 5: DeployConfirm ──

describe('DeployConfirm', () => {
  let wizardStore: WizardStore;

  beforeEach(() => {
    wizardStore = createWizardStore();
    wizardStore.getState().setProvider('gcp');
    wizardStore.getState().setProject('my-project');
    wizardStore.getState().setRegion('us-east1', 'us-east1-b');
    wizardStore.getState().setMachineType(GCP_MACHINE_CATALOG[0]!);
    wizardStore.getState().setStep(5);
  });

  it('should show summary of wizard selections', async () => {
    const { lastFrame } = render(
      React.createElement(DeployConfirm, {
        wizardStore,
        onDeploy: () => {},
      }),
    );

    const frame = lastFrame();
    expect(frame).toContain('gcp');
    expect(frame).toContain('my-project');
    expect(frame).toContain('us-east1');
  });

  it('should show instance type in summary', async () => {
    const { lastFrame } = render(
      React.createElement(DeployConfirm, {
        wizardStore,
        onDeploy: () => {},
      }),
    );

    expect(lastFrame()).toContain('Small Co-op');
  });

  it('should show server name text input', async () => {
    const { lastFrame } = render(
      React.createElement(DeployConfirm, {
        wizardStore,
        onDeploy: () => {},
      }),
    );

    // TextInput renders with placeholder or label
    expect(lastFrame()).toContain('Server Name');
  });

  it('should show game branch options', async () => {
    const { lastFrame } = render(
      React.createElement(DeployConfirm, {
        wizardStore,
        onDeploy: () => {},
      }),
    );

    const frame = lastFrame();
    expect(frame).toContain('stable');
  });

  it('should show Deploy key hint', async () => {
    const { lastFrame } = render(
      React.createElement(DeployConfirm, {
        wizardStore,
        onDeploy: () => {},
      }),
    );

    expect(lastFrame()).toContain('Deploy');
  });

  it('should use typed server name in deploy callback payload', async () => {
    const onDeploy = vi.fn();
    wizardStore.getState().setServerName('z1-server');
    const { stdin } = render(
      React.createElement(DeployConfirm, {
        wizardStore,
        onDeploy,
      }),
    );

    act(() => {
      stdin.write('\r');
    });
    await sleep(20);

    expect(onDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ serverName: expect.stringContaining('z1') }),
    );
  });

  it('should pass selected game branch in deploy callback payload', async () => {
    const onDeploy = vi.fn();
    wizardStore.getState().setServerName('my-server');
    wizardStore.getState().setGameBranch('unstable');
    const { stdin } = render(
      React.createElement(DeployConfirm, {
        wizardStore,
        onDeploy,
      }),
    );

    act(() => {
      stdin.write('\r');
    });
    await sleep(20);
    await sleep(20);

    expect(onDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ gameBranch: 'unstable' }),
    );
  });
});
