import React from 'react';
import { Box, useInput } from 'ink';
import { useStore } from 'zustand';
import { Header } from '@/presentation/components/Header.tsx';
import { KeyHint } from '@/presentation/components/KeyHint.tsx';
import type { WizardStore } from '@/presentation/store/wizard-store.ts';
import type { NavigationStore } from '@/presentation/store/navigation-store.ts';
import { useServices } from '@/presentation/hooks/use-services.tsx';
import { ProviderSelect } from './wizard-steps/ProviderSelect.tsx';
import { AuthProject } from './wizard-steps/AuthProject.tsx';
import { RegionSelect } from './wizard-steps/RegionSelect.tsx';
import { InstanceSelect } from './wizard-steps/InstanceSelect.tsx';
import { DeployConfirm } from './wizard-steps/DeployConfirm.tsx';
import type { GameBranch } from '@/domain/entities/enums.ts';
import type { MachineType } from '@/domain/entities/value-objects.ts';
import type { GcpProject } from '@/domain/repositories/i-cloud-provider.ts';
import { generateSshKeyPair } from '@/infrastructure/ssh/ssh-utils.ts';


export interface SetupWizardProps {
  readonly navigationStore: NavigationStore;
  readonly wizardStore: WizardStore;
}

export function SetupWizard({ navigationStore, wizardStore }: SetupWizardProps) {
  const step = useStore(wizardStore, (s) => s.step);
  const { cloudProvider, latency, deploy, localDb } = useServices();

  useInput((input, key) => {
    if (key.escape || input === '\x1B') {
      // Close wizard and return to previous context (not main/active-servers forced)
      if (process.env.NODE_ENV === 'test') {
        wizardStore.getState().reset();
        navigationStore.getState().popContext();
      } else {
        setTimeout(() => {
          wizardStore.getState().reset();
          navigationStore.getState().popContext();
        }, 0);
      }
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Header title="Setup Wizard" breadcrumb={[`Step ${step} of 5`]} />
      <Box paddingX={2} flexDirection="column" flexGrow={1}>

        {step === 1 && <ProviderSelect wizardStore={wizardStore} />}
        {step === 2 && <AuthProject 
          wizardStore={wizardStore} 
          onVerifyAuth={() => cloudProvider?.verifyAuth()}
          onListProjects={async () => {
            const projects = await cloudProvider?.listProjects();
            return (projects ?? []).map((p: GcpProject & { id?: string }) => ({
              id: p.projectId ?? p.id,
              name: p.name,
            }));
          }}
          onEnableApis={(projectId) => cloudProvider?.enableApis(projectId)}
        />}
        {step === 3 && <RegionSelect 
          wizardStore={wizardStore} 
          latencies={wizardStore.getState().latencies}
          onMeasureLatency={async () => {
            const results = await latency?.measureAllRegions();
            wizardStore.getState().setLatencies(results);
            return results;
          }}
        />}
        {step === 4 && <InstanceSelect
          wizardStore={wizardStore}
          onLoadDynamicCatalog={async () => {
            const state = wizardStore.getState();
            const provider = state.provider ?? 'gcp';
            const projectId = state.projectId ?? '';
            const region = state.region ?? '';
            if (!projectId || !region) {
              return [] as readonly MachineType[];
            }
            return (
              await cloudProvider?.listMachineTypes(projectId, region, provider)
            ) ?? [];
          }}
        />}
        {step === 5 && <DeployConfirm 
          wizardStore={wizardStore}
          onDeploy={async ({ serverName, gameBranch }: { serverName: string; gameBranch: GameBranch }) => {
            const state = wizardStore.getState();
            const normalizedServerName = serverName.trim();

            if (!normalizedServerName) {
              throw new Error('Server name is required');
            }

            const existingServers = await localDb?.listServers?.();
            const duplicated = (existingServers ?? []).some((server: { name?: string }) =>
              (server.name ?? '').trim().toLowerCase() === normalizedServerName.toLowerCase(),
            );

            if (duplicated) {
              throw new Error('Server name already exists');
            }

            const keypair = await generateSshKeyPair();
            const rconPassword = generateRconPassword();
            await deploy?.deploy({
              name: normalizedServerName,
              provider: state.provider!,
              projectId: state.projectId!,
              region: state.region!,
              zone: state.zone!,
              machineType: state.machineType!,
              gameBranch,
              sshPrivateKey: keypair.privateKey,
              sshPublicKey: keypair.publicKey,
              rconPassword,
            });

            navigationStore.getState().pop();
            setTimeout(() => wizardStore.getState().reset(), 10);
          }}
        />}
      </Box>

      <KeyHint hints={[{ key: 'ESC', label: 'Cancel' }]} />
    </Box>
  );
}

function generateRconPassword(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

