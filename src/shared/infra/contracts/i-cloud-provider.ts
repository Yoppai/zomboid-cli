import type { ServerId } from '../entities/enums.ts';
import type { ServerConfig, MachineType } from '../entities/value-objects.ts';

// ── Cloud Provider Supporting Types ──

export interface ProvisionRequest {
  readonly serverId: ServerId;
  readonly config: ServerConfig;
  readonly tfStateBucket: string;
  readonly cloudInitScript: string;
}

export interface ProvisionResult {
  readonly staticIp: string;
  readonly instanceZone: string;
  readonly success: boolean;
  readonly error?: string;
}

export interface DestroyResult {
  readonly success: boolean;
  readonly error?: string;
}

export interface GcpProject {
  readonly projectId: string;
  readonly name: string;
}

// ── Cloud Provider Port ──

export interface ICloudProvider {
  /** Verify gcloud CLI is authenticated and accessible */
  verifyAuth(): Promise<boolean>;

  /** List available GCP projects for authenticated user */
  listProjects(): Promise<readonly GcpProject[]>;

  /** Enable required APIs on a GCP project (compute, storage) */
  enableApis(projectId: string): Promise<void>;

  /** Ensure TF state bucket exists, create if needed */
  ensureStateBucket(projectId: string): Promise<string>;

  /** List available zones for a region */
  listZones(projectId: string, region: string): Promise<readonly string[]>;

  /** List machine types available in selected provider/region */
  listMachineTypes(
    projectId: string,
    region: string,
    provider: 'gcp' | 'aws' | 'azure',
  ): Promise<readonly MachineType[]>;

  /** Provision full server infrastructure via CDKTF */
  provision(request: ProvisionRequest): Promise<ProvisionResult>;

  /** Destroy all infrastructure for a server via CDKTF */
  destroy(
    serverId: ServerId,
    tfStateBucket: string,
    projectId: string,
  ): Promise<DestroyResult>;

  /** Check VM status via GCP API */
  getInstanceStatus(
    projectId: string,
    zone: string,
    instanceName: string,
  ): Promise<'RUNNING' | 'STOPPED' | 'TERMINATED' | 'STAGING' | 'NOT_FOUND'>;

  /** Stop VM instance */
  stopInstance(
    projectId: string,
    zone: string,
    instanceName: string,
  ): Promise<void>;

  /** Start VM instance */
  startInstance(
    projectId: string,
    zone: string,
    instanceName: string,
  ): Promise<void>;

  /** Change machine type (requires stopped VM) */
  changeMachineType(
    projectId: string,
    zone: string,
    instanceName: string,
    newMachineType: string,
  ): Promise<void>;
}
