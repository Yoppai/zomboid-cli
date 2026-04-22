import { describe, it, expect, beforeEach } from 'bun:test';
import {
  CdktfCloudProvider,
  type CloudProviderDeps,
} from '@/shared/infra/cdktf/cdktf-cloud-provider.ts';
import type { ServerId } from '@/shared/infra/entities/enums.ts';
import { createServerId } from '@/shared/infra/entities/enums.ts';
import type { ServerConfig } from '@/shared/infra/entities/value-objects.ts';
import { CdktfProvisionError, CdktfDestroyError } from '@/shared/infra/entities/errors.ts';

// ── Helpers ──

function makeSpawnFn(responses: Record<string, { stdout: string; stderr: string; exitCode: number }>) {
  return async (cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    const fullCmd = [cmd, ...args].join(' ');
    // Match by substring
    for (const [pattern, response] of Object.entries(responses)) {
      if (fullCmd.includes(pattern)) {
        return response;
      }
    }
    return { stdout: '', stderr: `Unknown command: ${fullCmd}`, exitCode: 1 };
  };
}

function makeServerConfig(overrides?: Partial<ServerConfig>): ServerConfig {
  return {
    name: 'test-server',
    provider: 'gcp',
    projectId: 'my-project',
    region: 'us-central1',
    zone: 'us-central1-a',
    machineType: {
      id: 'e2-standard-2',
      label: 'Small Co-op (1-8)',
      totalRamGb: 8,
      serverMemoryGb: 6,
      maxPlayers: '1-8',
    },
    gameBranch: 'stable',
    rconPassword: 'secret123',
    sshPublicKey: 'ssh-ed25519 AAAAC3Nza... zomboid-cli',
    sshPrivateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\n...',
    ...overrides,
  };
}

describe('CdktfCloudProvider', () => {
  describe('verifyAuth', () => {
    it('returns true when gcloud auth succeeds', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: makeSpawnFn({
          'auth print-access-token': { stdout: 'ya29.abc123\n', stderr: '', exitCode: 0 },
        }),
      };
      const provider = new CdktfCloudProvider(deps);
      const result = await provider.verifyAuth();
      expect(result).toBe(true);
    });

    it('returns false when gcloud auth fails', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: makeSpawnFn({
          'auth print-access-token': { stdout: '', stderr: 'ERROR: no credentials', exitCode: 1 },
        }),
      };
      const provider = new CdktfCloudProvider(deps);
      const result = await provider.verifyAuth();
      expect(result).toBe(false);
    });
  });

  describe('listProjects', () => {
    it('returns parsed list of GCP projects', async () => {
      const projectsJson = JSON.stringify([
        { projectId: 'proj-1', name: 'Project One' },
        { projectId: 'proj-2', name: 'Project Two' },
      ]);
      const deps: CloudProviderDeps = {
        spawnFn: makeSpawnFn({
          'projects list': { stdout: projectsJson, stderr: '', exitCode: 0 },
        }),
      };
      const provider = new CdktfCloudProvider(deps);
      const projects = await provider.listProjects();
      expect(projects.length).toBe(2);
      expect(projects[0]!.projectId).toBe('proj-1');
      expect(projects[0]!.name).toBe('Project One');
      expect(projects[1]!.projectId).toBe('proj-2');
    });

    it('returns empty array when no projects found', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: makeSpawnFn({
          'projects list': { stdout: '[]', stderr: '', exitCode: 0 },
        }),
      };
      const provider = new CdktfCloudProvider(deps);
      const projects = await provider.listProjects();
      expect(projects.length).toBe(0);
    });
  });

  describe('enableApis', () => {
    it('spawns gcloud services enable with correct APIs', async () => {
      const capturedCommands: string[] = [];
      const deps: CloudProviderDeps = {
        spawnFn: async (cmd: string, args: string[]) => {
          capturedCommands.push([cmd, ...args].join(' '));
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      };
      const provider = new CdktfCloudProvider(deps);
      await provider.enableApis('my-project');

      const enableCmd = capturedCommands.find((c) => c.includes('services enable'));
      expect(enableCmd).toBeDefined();
      expect(enableCmd).toContain('compute.googleapis.com');
      expect(enableCmd).toContain('storage-api.googleapis.com');
    });

    it('throws when API enablement fails', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: makeSpawnFn({
          'services enable': {
            stdout: '',
            stderr: 'ERROR: permission denied',
            exitCode: 1,
          },
        }),
      };
      const provider = new CdktfCloudProvider(deps);
      await expect(provider.enableApis('my-project')).rejects.toThrow();
    });
  });

  describe('ensureStateBucket', () => {
    it('returns bucket name in format zomboid-cli-tfstate-{projectId}', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
        storageBucketExistsFn: async () => true,
      };
      const provider = new CdktfCloudProvider(deps);
      const bucket = await provider.ensureStateBucket('my-project');
      expect(bucket).toBe('zomboid-cli-tfstate-my-project');
    });

    it('creates bucket when it does not exist', async () => {
      let bucketCreated = false;
      const deps: CloudProviderDeps = {
        spawnFn: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
        storageBucketExistsFn: async () => false,
        storageBucketCreateFn: async (bucketName: string) => {
          bucketCreated = true;
          expect(bucketName).toBe('zomboid-cli-tfstate-my-project');
        },
      };
      const provider = new CdktfCloudProvider(deps);
      await provider.ensureStateBucket('my-project');
      expect(bucketCreated).toBe(true);
    });

    it('does not create bucket when it already exists', async () => {
      let createCalled = false;
      const deps: CloudProviderDeps = {
        spawnFn: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
        storageBucketExistsFn: async () => true,
        storageBucketCreateFn: async () => {
          createCalled = true;
        },
      };
      const provider = new CdktfCloudProvider(deps);
      await provider.ensureStateBucket('my-project');
      expect(createCalled).toBe(false);
    });
  });

  describe('listZones', () => {
    it('returns parsed list of zone names', async () => {
      const zonesJson = JSON.stringify([
        { name: 'us-central1-a' },
        { name: 'us-central1-b' },
        { name: 'us-central1-c' },
      ]);
      const deps: CloudProviderDeps = {
        spawnFn: makeSpawnFn({
          'compute zones list': {
            stdout: zonesJson,
            stderr: '',
            exitCode: 0,
          },
        }),
      };
      const provider = new CdktfCloudProvider(deps);
      const zones = await provider.listZones('my-project', 'us-central1');
      expect(zones.length).toBe(3);
      expect(zones[0]).toBe('us-central1-a');
      expect(zones[2]).toBe('us-central1-c');
    });
  });

  describe('listMachineTypes', () => {
    it('returns dynamic machine catalog scoped by region', async () => {
      const machineTypesJson = JSON.stringify([
        {
          name: 'n2-standard-8',
          memoryMb: 32768,
          guestCpus: 8,
        },
        {
          name: 'e2-standard-4',
          memoryMb: 16384,
          guestCpus: 4,
        },
      ]);

      const deps: CloudProviderDeps = {
        spawnFn: makeSpawnFn({
          'compute machine-types list': {
            stdout: machineTypesJson,
            stderr: '',
            exitCode: 0,
          },
        }),
      };

      const provider = new CdktfCloudProvider(deps);
      const machineTypes = await (provider as any).listMachineTypes('my-project', 'us-east1', 'gcp');

      expect(machineTypes.length).toBe(2);
      const n2 = machineTypes.find((machine: any) => machine.id === 'n2-standard-8');
      expect(n2).toBeDefined();
      expect(n2.totalRamGb).toBe(32);
      expect(n2.serverMemoryGb).toBe(26);
    });
  });

  describe('provision', () => {
    it('returns ProvisionResult with static IP on success', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: async (cmd: string, args: string[]) => {
          const fullCmd = [cmd, ...args].join(' ');
          if (fullCmd.includes('terraform') && fullCmd.includes('init')) {
            return { stdout: 'Initialized', stderr: '', exitCode: 0 };
          }
          if (fullCmd.includes('terraform') && fullCmd.includes('apply')) {
            return { stdout: 'Apply complete! Resources: 3 added\n', stderr: '', exitCode: 0 };
          }
          if (fullCmd.includes('terraform') && fullCmd.includes('output')) {
            return { stdout: '34.56.78.90', stderr: '', exitCode: 0 };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
        synthesizeFn: () => '/tmp/synth-dir',
      };
      const provider = new CdktfCloudProvider(deps);
      const result = await provider.provision({
        serverId: createServerId('srv-001'),
        config: makeServerConfig(),
        tfStateBucket: 'zomboid-cli-tfstate-my-project',
        cloudInitScript: '#!/bin/bash\necho hello',
      });
      expect(result.success).toBe(true);
      expect(result.staticIp).toBe('34.56.78.90');
      expect(result.instanceZone).toBe('us-central1-a');
    });

    it('returns failure result and wraps error in CdktfProvisionError on terraform failure', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: async (cmd: string, args: string[]) => {
          const fullCmd = [cmd, ...args].join(' ');
          if (fullCmd.includes('terraform') && fullCmd.includes('init')) {
            return { stdout: 'Initialized', stderr: '', exitCode: 0 };
          }
          if (fullCmd.includes('terraform') && fullCmd.includes('apply')) {
            return { stdout: '', stderr: 'Error: quota exceeded', exitCode: 1 };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
        synthesizeFn: () => '/tmp/synth-dir',
      };
      const provider = new CdktfCloudProvider(deps);

      try {
        await provider.provision({
          serverId: createServerId('srv-002'),
          config: makeServerConfig(),
          tfStateBucket: 'zomboid-cli-tfstate-my-project',
          cloudInitScript: '#!/bin/bash',
        });
        expect(true).toBe(false); // should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(CdktfProvisionError);
      }
    });

    it('calls synthesize with correct config', async () => {
      let capturedConfig: any = null;
      const deps: CloudProviderDeps = {
        spawnFn: async (cmd: string, args: string[]) => {
          const fullCmd = [cmd, ...args].join(' ');
          if (fullCmd.includes('output')) {
            return { stdout: '1.2.3.4', stderr: '', exitCode: 0 };
          }
          return { stdout: 'ok', stderr: '', exitCode: 0 };
        },
        synthesizeFn: (config: any) => {
          capturedConfig = config;
          return '/tmp/synth';
        },
      };
      const provider = new CdktfCloudProvider(deps);
      const serverConfig = makeServerConfig({ projectId: 'captured-project' });

      await provider.provision({
        serverId: createServerId('srv-003'),
        config: serverConfig,
        tfStateBucket: 'my-bucket',
        cloudInitScript: '#!/bin/bash',
      });

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig.serverId).toBe('srv-003');
      expect(capturedConfig.projectId).toBe('captured-project');
      expect(capturedConfig.tfStateBucket).toBe('my-bucket');
    });
  });

  describe('destroy', () => {
    it('returns success DestroyResult on terraform destroy success', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: async (cmd: string, args: string[]) => {
          const fullCmd = [cmd, ...args].join(' ');
          if (fullCmd.includes('terraform') && fullCmd.includes('init')) {
            return { stdout: 'Initialized', stderr: '', exitCode: 0 };
          }
          if (fullCmd.includes('terraform') && fullCmd.includes('destroy')) {
            return { stdout: 'Destroy complete! Resources: 3 destroyed', stderr: '', exitCode: 0 };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
        synthesizeFn: () => '/tmp/synth-dir',
      };
      const provider = new CdktfCloudProvider(deps);
      const result = await provider.destroy(
        createServerId('srv-001'),
        'zomboid-cli-tfstate-my-project',
        'my-project',
      );
      expect(result.success).toBe(true);
    });

    it('throws CdktfDestroyError on terraform destroy failure', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: async (cmd: string, args: string[]) => {
          const fullCmd = [cmd, ...args].join(' ');
          if (fullCmd.includes('terraform') && fullCmd.includes('init')) {
            return { stdout: 'Initialized', stderr: '', exitCode: 0 };
          }
          if (fullCmd.includes('terraform') && fullCmd.includes('destroy')) {
            return { stdout: '', stderr: 'Error: resource still exists', exitCode: 1 };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
        synthesizeFn: () => '/tmp/synth-dir',
      };
      const provider = new CdktfCloudProvider(deps);

      try {
        await provider.destroy(
          createServerId('srv-001'),
          'zomboid-cli-tfstate-my-project',
          'my-project',
        );
        expect(true).toBe(false); // should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(CdktfDestroyError);
      }
    });
  });

  describe('getInstanceStatus', () => {
    it('returns RUNNING when gcloud reports RUNNING', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: makeSpawnFn({
          'instances describe': {
            stdout: JSON.stringify({ status: 'RUNNING' }),
            stderr: '',
            exitCode: 0,
          },
        }),
      };
      const provider = new CdktfCloudProvider(deps);
      const status = await provider.getInstanceStatus('proj', 'zone-a', 'vm-1');
      expect(status).toBe('RUNNING');
    });

    it('returns STOPPED when gcloud reports TERMINATED', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: makeSpawnFn({
          'instances describe': {
            stdout: JSON.stringify({ status: 'TERMINATED' }),
            stderr: '',
            exitCode: 0,
          },
        }),
      };
      const provider = new CdktfCloudProvider(deps);
      const status = await provider.getInstanceStatus('proj', 'zone-a', 'vm-1');
      expect(status).toBe('TERMINATED');
    });

    it('returns NOT_FOUND when instance does not exist', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: makeSpawnFn({
          'instances describe': {
            stdout: '',
            stderr: 'ERROR: (gcloud.compute.instances.describe) not found',
            exitCode: 1,
          },
        }),
      };
      const provider = new CdktfCloudProvider(deps);
      const status = await provider.getInstanceStatus('proj', 'zone-a', 'vm-1');
      expect(status).toBe('NOT_FOUND');
    });
  });

  describe('stopInstance', () => {
    it('spawns gcloud compute instances stop', async () => {
      const capturedCommands: string[] = [];
      const deps: CloudProviderDeps = {
        spawnFn: async (cmd: string, args: string[]) => {
          capturedCommands.push([cmd, ...args].join(' '));
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      };
      const provider = new CdktfCloudProvider(deps);
      await provider.stopInstance('proj', 'zone-a', 'vm-1');
      const stopCmd = capturedCommands.find((c) => c.includes('instances stop'));
      expect(stopCmd).toBeDefined();
      expect(stopCmd).toContain('vm-1');
      expect(stopCmd).toContain('zone-a');
    });
  });

  describe('startInstance', () => {
    it('spawns gcloud compute instances start', async () => {
      const capturedCommands: string[] = [];
      const deps: CloudProviderDeps = {
        spawnFn: async (cmd: string, args: string[]) => {
          capturedCommands.push([cmd, ...args].join(' '));
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      };
      const provider = new CdktfCloudProvider(deps);
      await provider.startInstance('proj', 'zone-a', 'vm-1');
      const startCmd = capturedCommands.find((c) => c.includes('instances start'));
      expect(startCmd).toBeDefined();
      expect(startCmd).toContain('vm-1');
    });
  });

  describe('changeMachineType', () => {
    it('spawns gcloud compute instances set-machine-type', async () => {
      const capturedCommands: string[] = [];
      const deps: CloudProviderDeps = {
        spawnFn: async (cmd: string, args: string[]) => {
          capturedCommands.push([cmd, ...args].join(' '));
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      };
      const provider = new CdktfCloudProvider(deps);
      await provider.changeMachineType('proj', 'zone-a', 'vm-1', 'n2-standard-4');
      const changeCmd = capturedCommands.find((c) => c.includes('set-machine-type'));
      expect(changeCmd).toBeDefined();
      expect(changeCmd).toContain('n2-standard-4');
    });

    it('throws when change machine type fails', async () => {
      const deps: CloudProviderDeps = {
        spawnFn: makeSpawnFn({
          'set-machine-type': {
            stdout: '',
            stderr: 'ERROR: instance must be stopped',
            exitCode: 1,
          },
        }),
      };
      const provider = new CdktfCloudProvider(deps);
      await expect(
        provider.changeMachineType('proj', 'zone-a', 'vm-1', 'n2-standard-4'),
      ).rejects.toThrow();
    });
  });
});
