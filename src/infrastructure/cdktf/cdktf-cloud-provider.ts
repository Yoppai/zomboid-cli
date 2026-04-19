import type {
  ICloudProvider,
  ProvisionRequest,
  ProvisionResult,
  DestroyResult,
  GcpProject,
} from '@/domain/repositories/i-cloud-provider.ts';
import type { ServerId } from '@/domain/entities/enums.ts';
import type { MachineType } from '@/domain/entities/value-objects.ts';
import { calculateServerMemory } from '@/domain/entities/machine-catalog.ts';
import {
  CdktfProvisionError,
  CdktfDestroyError,
} from '@/domain/entities/errors.ts';
import {
  synthesizeStack,
  type ServerStackConfig,
} from './zomboid-server-stack.ts';
import { generateCloudInit } from './templates/cloud-init.ts';
import { generateDockerCompose } from './templates/docker-compose.ts';

// ── Spawn Result ──

interface SpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

// ── Injectable Dependencies ──

export interface CloudProviderDeps {
  /** Spawn a command and capture output (for testing) */
  spawnFn?: (cmd: string, args: string[]) => Promise<SpawnResult>;
  /** Override CDKTF synthesize (for testing without real CDKTF) */
  synthesizeFn?: (config: ServerStackConfig) => string;
  /** Check if a GCS bucket exists (for testing) */
  storageBucketExistsFn?: (bucketName: string) => Promise<boolean>;
  /** Create a GCS bucket (for testing) */
  storageBucketCreateFn?: (bucketName: string) => Promise<void>;
}

// ── Default spawn using Bun ──

async function defaultSpawn(
  cmd: string,
  args: string[],
): Promise<SpawnResult> {
  const proc = Bun.spawn([cmd, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

// ── CdktfCloudProvider ──

/**
 * Implements ICloudProvider using CDKTF for infrastructure synthesis
 * and gcloud CLI for GCP operations.
 *
 * Flow: CDKTF App.synth() → Terraform JSON → spawn terraform apply/destroy.
 * GCP management operations use gcloud CLI.
 */
export class CdktfCloudProvider implements ICloudProvider {
  private readonly spawnFn: (cmd: string, args: string[]) => Promise<SpawnResult>;
  private readonly synthesizeFn: (config: ServerStackConfig) => string;
  private readonly storageBucketExistsFn: (bucketName: string) => Promise<boolean>;
  private readonly storageBucketCreateFn: (bucketName: string) => Promise<void>;

  constructor(deps?: CloudProviderDeps) {
    this.spawnFn = deps?.spawnFn ?? defaultSpawn;
    this.synthesizeFn = deps?.synthesizeFn ?? synthesizeStack;
    this.storageBucketExistsFn = deps?.storageBucketExistsFn ?? this.defaultBucketExists.bind(this);
    this.storageBucketCreateFn = deps?.storageBucketCreateFn ?? this.defaultBucketCreate.bind(this);
  }

  // ── ICloudProvider Methods ──

  async verifyAuth(): Promise<boolean> {
    const result = await this.spawnFn('gcloud', [
      'auth',
      'print-access-token',
    ]);
    return result.exitCode === 0;
  }

  async listProjects(): Promise<readonly GcpProject[]> {
    const result = await this.spawnFn('gcloud', [
      'projects',
      'list',
      '--format=json',
    ]);
    if (result.exitCode !== 0) {
      return [];
    }
    try {
      const raw = JSON.parse(result.stdout) as Array<{
        projectId: string;
        name: string;
      }>;
      return raw.map((p) => ({
        projectId: p.projectId,
        name: p.name,
      }));
    } catch {
      return [];
    }
  }

  async enableApis(projectId: string): Promise<void> {
    const result = await this.spawnFn('gcloud', [
      'services',
      'enable',
      'compute.googleapis.com',
      'storage-api.googleapis.com',
      `--project=${projectId}`,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to enable APIs: ${result.stderr}`,
      );
    }
  }

  async ensureStateBucket(projectId: string): Promise<string> {
    const bucketName = `zomboid-cli-tfstate-${projectId}`;
    const exists = await this.storageBucketExistsFn(bucketName);
    if (!exists) {
      await this.storageBucketCreateFn(bucketName);
    }
    return bucketName;
  }

  async listZones(
    projectId: string,
    region: string,
  ): Promise<readonly string[]> {
    const result = await this.spawnFn('gcloud', [
      'compute',
      'zones',
      'list',
      `--filter=region:${region}`,
      '--format=json',
      `--project=${projectId}`,
    ]);
    if (result.exitCode !== 0) {
      return [];
    }
    try {
      const raw = JSON.parse(result.stdout) as Array<{ name: string }>;
      return raw.map((z) => z.name);
    } catch {
      return [];
    }
  }

  async listMachineTypes(
    projectId: string,
    region: string,
    provider: 'gcp' | 'aws' | 'azure',
  ): Promise<readonly MachineType[]> {
    if (provider !== 'gcp') {
      return [];
    }

    const result = await this.spawnFn('gcloud', [
      'compute',
      'machine-types',
      'list',
      `--filter=zone~^${region}-`,
      '--format=json',
      `--project=${projectId}`,
    ]);

    if (result.exitCode !== 0) {
      return [];
    }

    try {
      const raw = JSON.parse(result.stdout) as Array<{
        name: string;
        memoryMb: number;
        guestCpus: number;
      }>;

      const dedup = new Map<string, MachineType>();

      for (const item of raw) {
        const totalRamGb = Math.ceil(item.memoryMb / 1024);
        dedup.set(item.name, {
          id: item.name,
          label: `${item.name} (${totalRamGb}GB RAM, ${item.guestCpus} vCPU)`,
          totalRamGb,
          serverMemoryGb: calculateServerMemory(totalRamGb),
          maxPlayers: 'dynamic',
        });
      }

      return [...dedup.values()].sort((a, b) => {
        if (a.totalRamGb !== b.totalRamGb) {
          return a.totalRamGb - b.totalRamGb;
        }
        return a.id.localeCompare(b.id);
      });
    } catch {
      return [];
    }
  }

  async provision(request: ProvisionRequest): Promise<ProvisionResult> {
    const { serverId, config, tfStateBucket, cloudInitScript } = request;

    // Build stack config
    const stackConfig: ServerStackConfig = {
      serverId,
      projectId: config.projectId,
      region: config.region,
      zone: config.zone,
      machineType: config.machineType.id,
      sshPublicKey: config.sshPublicKey,
      cloudInitScript,
      tfStateBucket,
    };

    // Synthesize CDKTF stack to Terraform JSON
    const synthDir = this.synthesizeFn(stackConfig);
    const stackDir = `${synthDir}/stacks/zomboid-${serverId}`;

    // Run terraform init
    const initResult = await this.spawnFn('terraform', [
      `-chdir=${stackDir}`,
      'init',
    ]);
    if (initResult.exitCode !== 0) {
      throw new CdktfProvisionError(
        new Error(`terraform init failed: ${initResult.stderr}`),
      );
    }

    // Run terraform apply
    const applyResult = await this.spawnFn('terraform', [
      `-chdir=${stackDir}`,
      'apply',
      '-auto-approve',
    ]);
    if (applyResult.exitCode !== 0) {
      throw new CdktfProvisionError(
        new Error(`terraform apply failed: ${applyResult.stderr}`),
      );
    }

    // Get the static IP from terraform output
    const outputResult = await this.spawnFn('terraform', [
      `-chdir=${stackDir}`,
      'output',
      '-raw',
      'static_ip',
    ]);
    const staticIp = outputResult.stdout.trim();

    return {
      staticIp: staticIp || '0.0.0.0',
      instanceZone: config.zone,
      success: true,
    };
  }

  async destroy(
    serverId: ServerId,
    tfStateBucket: string,
    projectId: string,
  ): Promise<DestroyResult> {
    // Synthesize a minimal stack for destroy
    const stackConfig: ServerStackConfig = {
      serverId,
      projectId,
      region: 'us-central1', // region doesn't matter for destroy
      zone: 'us-central1-a',
      machineType: 'e2-standard-2',
      sshPublicKey: '',
      cloudInitScript: '',
      tfStateBucket,
    };

    const synthDir = this.synthesizeFn(stackConfig);
    const stackDir = `${synthDir}/stacks/zomboid-${serverId}`;

    // Run terraform init
    const initResult = await this.spawnFn('terraform', [
      `-chdir=${stackDir}`,
      'init',
    ]);
    if (initResult.exitCode !== 0) {
      throw new CdktfDestroyError(
        new Error(`terraform init failed: ${initResult.stderr}`),
      );
    }

    // Run terraform destroy
    const destroyResult = await this.spawnFn('terraform', [
      `-chdir=${stackDir}`,
      'destroy',
      '-auto-approve',
    ]);
    if (destroyResult.exitCode !== 0) {
      throw new CdktfDestroyError(
        new Error(`terraform destroy failed: ${destroyResult.stderr}`),
      );
    }

    return { success: true };
  }

  async getInstanceStatus(
    projectId: string,
    zone: string,
    instanceName: string,
  ): Promise<'RUNNING' | 'STOPPED' | 'TERMINATED' | 'STAGING' | 'NOT_FOUND'> {
    const result = await this.spawnFn('gcloud', [
      'compute',
      'instances',
      'describe',
      instanceName,
      `--zone=${zone}`,
      `--project=${projectId}`,
      '--format=json',
    ]);
    if (result.exitCode !== 0) {
      return 'NOT_FOUND';
    }
    try {
      const data = JSON.parse(result.stdout) as { status: string };
      return data.status as
        | 'RUNNING'
        | 'STOPPED'
        | 'TERMINATED'
        | 'STAGING'
        | 'NOT_FOUND';
    } catch {
      return 'NOT_FOUND';
    }
  }

  async stopInstance(
    projectId: string,
    zone: string,
    instanceName: string,
  ): Promise<void> {
    const result = await this.spawnFn('gcloud', [
      'compute',
      'instances',
      'stop',
      instanceName,
      `--zone=${zone}`,
      `--project=${projectId}`,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to stop instance: ${result.stderr}`);
    }
  }

  async startInstance(
    projectId: string,
    zone: string,
    instanceName: string,
  ): Promise<void> {
    const result = await this.spawnFn('gcloud', [
      'compute',
      'instances',
      'start',
      instanceName,
      `--zone=${zone}`,
      `--project=${projectId}`,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to start instance: ${result.stderr}`);
    }
  }

  async changeMachineType(
    projectId: string,
    zone: string,
    instanceName: string,
    newMachineType: string,
  ): Promise<void> {
    const result = await this.spawnFn('gcloud', [
      'compute',
      'instances',
      'set-machine-type',
      instanceName,
      `--machine-type=${newMachineType}`,
      `--zone=${zone}`,
      `--project=${projectId}`,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to change machine type: ${result.stderr}`,
      );
    }
  }

  // ── Default GCS bucket helpers ──

  private async defaultBucketExists(bucketName: string): Promise<boolean> {
    const result = await this.spawnFn('gcloud', [
      'storage',
      'buckets',
      'describe',
      `gs://${bucketName}`,
      '--format=json',
    ]);
    return result.exitCode === 0;
  }

  private async defaultBucketCreate(bucketName: string): Promise<void> {
    const result = await this.spawnFn('gcloud', [
      'storage',
      'buckets',
      'create',
      `gs://${bucketName}`,
      '--location=us',
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to create bucket: ${result.stderr}`);
    }
  }
}
