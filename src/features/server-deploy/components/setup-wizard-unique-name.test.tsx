import React, { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'bun:test';
import { render } from 'ink-testing-library';
import { SetupWizard } from '@/features/server-deploy/components/SetupWizard.tsx';
import { createNavigationStore } from '@/shared/infra/navigation-store.ts';
import { createWizardStore } from '@/features/server-deploy/model/wizard-store.ts';
import { createUiStore } from '@/shared/infra/ui-store.ts';
import { GCP_MACHINE_CATALOG } from '@/shared/infra/entities/machine-catalog.ts';

const deploySpy = vi.fn();
const listServersSpy = vi.fn();

vi.mock('@/shared/hooks/use-services.tsx', () => ({
  useServices: () => ({
    cloudProvider: {
      verifyAuth: vi.fn().mockResolvedValue(true),
      listProjects: vi.fn().mockResolvedValue([]),
      enableApis: vi.fn().mockResolvedValue(undefined),
      listMachineTypes: vi.fn().mockResolvedValue([]),
    },
    latency: {
      measureAllRegions: vi.fn().mockResolvedValue([]),
    },
    deploy: {
      deploy: deploySpy,
    },
    localDb: {
      listServers: listServersSpy,
    },
  }),
  ServiceProvider: ({ children }: any) => <>{children}</>,
}));

describe('SetupWizard server name uniqueness', () => {
  beforeEach(() => {
    deploySpy.mockReset();
    listServersSpy.mockReset();
    deploySpy.mockResolvedValue({ id: 'srv-1', status: 'provisioning' });
  });

  it('blocks confirmation when server name already exists in sqlite', async () => {
    listServersSpy.mockResolvedValue([{ name: 'my-server' }]);

    const wizardStore = createWizardStore();
    const navigationStore = createNavigationStore();
    const uiStore = createUiStore();
    wizardStore.getState().setProvider('gcp');
    wizardStore.getState().setProject('project-1');
    wizardStore.getState().setRegion('us-east1', 'us-east1-b');
    wizardStore.getState().setMachineType(GCP_MACHINE_CATALOG[0]!);
    wizardStore.getState().setServerName('my-server');
    wizardStore.getState().setStep(5);

    const { stdin, lastFrame } = render(
      <SetupWizard navStore={navigationStore} wizardStore={wizardStore} uiStore={uiStore} />,
    );

    act(() => {
      stdin.write('\r');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(listServersSpy).toHaveBeenCalled();
    expect(deploySpy).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('Server name already exists');
  });

  it('allows confirmation when server name is unique', async () => {
    listServersSpy.mockResolvedValue([{ name: 'other-server' }]);

    const wizardStore = createWizardStore();
    const navigationStore = createNavigationStore();
    const uiStore = createUiStore();
    wizardStore.getState().setProvider('gcp');
    wizardStore.getState().setProject('project-1');
    wizardStore.getState().setRegion('us-east1', 'us-east1-b');
    wizardStore.getState().setMachineType(GCP_MACHINE_CATALOG[0]!);
    wizardStore.getState().setServerName('fresh-server');
    wizardStore.getState().setStep(5);

    const { stdin } = render(
      <SetupWizard navStore={navigationStore} wizardStore={wizardStore} uiStore={uiStore} />,
    );

    act(() => {
      stdin.write('\r');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(listServersSpy).toHaveBeenCalled();
    expect(deploySpy).toHaveBeenCalledTimes(1);
    expect(deploySpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'fresh-server' }),
    );
  });
});
