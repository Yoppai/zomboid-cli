import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Spinner } from '@/presentation/components/Spinner.tsx';
import { SelectList } from '@/presentation/components/SelectList.tsx';
import type { WizardStore } from '@/presentation/store/wizard-store.ts';

export interface AuthProjectProps {
  readonly wizardStore: WizardStore;
  readonly onVerifyAuth?: () => Promise<boolean>;
  readonly onListProjects?: () => Promise<{id: string, name: string}[]>;
  readonly onEnableApis?: (projectId: string) => Promise<void>;
}

export function AuthProject({ wizardStore, onVerifyAuth, onListProjects, onEnableApis }: AuthProjectProps) {
  const [status, setStatus] = useState<'checking' | 'error' | 'loaded' | 'enabling' | 'api-error'>('checking');
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [enableError, setEnableError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const isValid = await (onVerifyAuth ? onVerifyAuth() : Promise.resolve(false));
        if (!active) return;
        if (!isValid) {
          setStatus('error');
          return;
        }
        const projs = await (onListProjects ? onListProjects() : Promise.resolve([]));
        if (!active) return;
        setProjects(projs);
        setStatus('loaded');
      } catch (e) {
        if (active) setStatus('error');
      }
    }
    check();
    return () => { active = false; };
  }, [onVerifyAuth, onListProjects]);

  if (status === 'checking') {
    return <Spinner label="Checking GCP authentication..." />;
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="red">Authentication Failed</Text>
        <Text>Please run <Text color="yellow">gcloud auth login</Text> to authenticate.</Text>
      </Box>
    );
  }

  if (status === 'enabling') {
    return <Spinner label="Enabling required APIs..." />;
  }

  const enableProjectApis = async (projectId: string) => {
    setSelectedProject(projectId);
    setStatus('enabling');
    setEnableError(null);

    try {
      if (onEnableApis) {
        await onEnableApis(projectId);
      }
      wizardStore.getState().setProject(projectId);
      wizardStore.getState().setStep(3);
    } catch (error) {
      setEnableError(error instanceof Error ? error.message : String(error));
      setStatus('api-error');
    }
  };

  if (status === 'api-error') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="red">Failed to enable required APIs</Text>
        <Text>{enableError ?? 'Unknown error enabling APIs.'}</Text>
        <Text>Required permission: serviceusage.services.enable</Text>
        <SelectList
          items={[
            { label: 'Retry', value: 'retry' },
            { label: 'Back', value: 'back' },
          ]}
          onSelect={(value) => {
            if (value === 'retry' && selectedProject) {
              void enableProjectApis(selectedProject);
              return;
            }
            wizardStore.getState().setStep(1);
          }}
        />
      </Box>
    );
  }

  const items = projects.map(p => ({ label: `${p.name} (${p.id})`, value: p.id }));

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Select GCP Project</Text>
      <SelectList
        items={items}
        onSelect={(val) => {
          void enableProjectApis(val);
        }}
      />
    </Box>
  );
}
