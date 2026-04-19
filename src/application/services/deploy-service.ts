import type { ICloudProvider, ProvisionRequest } from '@/domain/repositories/i-cloud-provider.ts';
import type { ISshGateway } from '@/domain/repositories/i-ssh-gateway.ts';
import type { ILocalDb } from '@/domain/repositories/i-local-db.ts';
import type { ServerRecord } from '@/domain/entities/server-record.ts';
import type { ServerConfig, MachineType, SshConnectionConfig } from '@/domain/entities/value-objects.ts';
import type { ServerId } from '@/domain/entities/enums.ts';
import { createServerId } from '@/domain/entities/enums.ts';
import {
  CdktfProvisionError,
  VmBootTimeoutError,
  CloudInitTimeoutError,
} from '@/domain/entities/errors.ts';
import { generateCloudInit } from '@/infrastructure/cdktf/templates/cloud-init.ts';
import { generateDockerCompose } from '@/infrastructure/cdktf/templates/docker-compose.ts';
import { calculateServerMemory, findMachineType } from '@/domain/entities/machine-catalog.ts';

// ── Deploy Options (injectable for testing) ──

export interface DeployOptions {
  readonly vmBootMaxPollAttempts: number;
  readonly cloudInitMaxPollAttempts: number;
  readonly maxPollAttempts: number;
  readonly pollIntervalMs: number;
  readonly sleepFn: (ms: number) => Promise<void>;
}

const DEFAULT_OPTIONS: DeployOptions = {
  vmBootMaxPollAttempts: 36,
  cloudInitMaxPollAttempts: 60,
  maxPollAttempts: 60,
  pollIntervalMs: 5000,
  sleepFn: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// ── DeployService ──

export class DeployService {
  private readonly opts: DeployOptions;

  constructor(
    private readonly cloud: ICloudProvider,
    private readonly ssh: ISshGateway,
    private readonly db: ILocalDb,
    opts?: Partial<DeployOptions>,
  ) {
    const merged = { ...DEFAULT_OPTIONS, ...opts };
    const legacyMax = opts?.maxPollAttempts;

    this.opts = {
      ...merged,
      vmBootMaxPollAttempts: opts?.vmBootMaxPollAttempts ?? legacyMax ?? DEFAULT_OPTIONS.vmBootMaxPollAttempts,
      cloudInitMaxPollAttempts: opts?.cloudInitMaxPollAttempts ?? legacyMax ?? DEFAULT_OPTIONS.cloudInitMaxPollAttempts,
    };
  }

  /**
   * Full deploy flow:
   * 1. Create ServerRecord with status='provisioning'
   * 2. Provision cloud infrastructure (CDKTF apply)
   * 3. Save static IP from provision result
   * 4. Poll SSH connectivity (wait for cloud-init)
   * 5. Health check (docker compose ps)
   * 6. Update status to 'running'
   * On failure: status='failed' + errorMessage
   */
  async deploy(config: ServerConfig): Promise<ServerRecord> {
    const id = createServerId(crypto.randomUUID());
    const now = new Date().toISOString();

    // 1. Create server record
    const record: ServerRecord = {
      id,
      name: config.name,
      provider: config.provider,
      projectId: config.projectId,
      instanceType: config.machineType.id,
      instanceZone: config.zone,
      staticIp: null,
      sshPrivateKey: config.sshPrivateKey,
      rconPassword: config.rconPassword,
      gameBranch: config.gameBranch,
      status: 'provisioning',
      errorMessage: null,
      backupPath: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.createServer(record);

    try {
      // 2. Build templates and provision
      const serverMemoryGb = calculateServerMemory(config.machineType.totalRamGb);
      const dockerCompose = generateDockerCompose({
        serverName: config.name,
        serverMemory: `${serverMemoryGb}g`,
        rconPassword: config.rconPassword,
        gameBranch: config.gameBranch,
      });
      const cloudInit = generateCloudInit({ dockerComposeContent: dockerCompose });

      // Ensure the GCS bucket for Terraform state exists before provisioning
      const tfStateBucket = await this.cloud.ensureStateBucket(config.projectId);

      const provisionRequest: ProvisionRequest = {
        serverId: id,
        config,
        tfStateBucket,
        cloudInitScript: cloudInit,
      };

      const result = await this.cloud.provision(provisionRequest);

      if (!result.success) {
        throw new CdktfProvisionError(new Error(result.error ?? 'Provision failed'));
      }

      // 3. Save static IP
      const updatedAt = new Date().toISOString();
      await this.db.updateServer(id, {
        staticIp: result.staticIp,
        updatedAt,
      });

      // 4. Poll VM boot status (cloud provider status API)
      await this.waitForVmBoot(id, config.projectId, result.instanceZone, this.instanceNameFromConfig(config));

      // 5. Poll cloud-init/health checks via SSH
      const conn: SshConnectionConfig = {
        host: result.staticIp,
        port: 22,
        username: 'root',
        privateKey: config.sshPrivateKey,
      };

      await this.waitForCloudInit(conn, id);

      // 6. Update status to running
      const finalUpdatedAt = new Date().toISOString();
      await this.db.updateServer(id, {
        status: 'running',
        updatedAt: finalUpdatedAt,
      });

      // Return the final state
      return {
        ...record,
        staticIp: result.staticIp,
        status: 'running' as const,
        updatedAt: finalUpdatedAt,
      };
    } catch (error) {
      // On ANY failure: set status='failed' + errorMessage
      const errorMsg = this.buildPersistedErrorMessage(error);
      await this.db.updateServer(id, {
        status: 'failed',
        errorMessage: errorMsg,
        updatedAt: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Start a stopped server container via SSH compose up.
   */
  async startServer(id: ServerId): Promise<void> {
    const server = await this.requireServer(id);

    const conn = this.requireSshConn(server);
    await this.ssh.exec(conn, 'docker compose -f /opt/zomboid/docker-compose.yml up -d');

    await this.db.updateServer(id, {
      status: 'running',
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Stop a running server container via SSH compose down.
   */
  async stopServer(id: ServerId): Promise<void> {
    const server = await this.requireServer(id);

    const conn = this.requireSshConn(server);
    await this.ssh.exec(conn, 'docker compose -f /opt/zomboid/docker-compose.yml down');

    await this.db.updateServer(id, {
      status: 'stopped',
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Change instance type: stop → resize → start
   */
  async changeInstanceType(id: ServerId, newType: MachineType): Promise<void> {
    const server = await this.requireServer(id);
    const instanceName = this.instanceName(server);
    const wasRunning = server.status === 'running';
    const originalMachineTypeId = server.instanceType;
    const originalMachine = findMachineType(originalMachineTypeId);
    const originalMemory = originalMachine
      ? `${calculateServerMemory(originalMachine.totalRamGb)}g`
      : null;
    const newMemory = `${calculateServerMemory(newType.totalRamGb)}g`;

    const conn = server.staticIp
      ? this.requireSshConn(server)
      : null;

    let vmStopped = false;
    let machineChanged = false;
    let vmStarted = false;
    let composeUpdated = false;

    try {
      // 1. Stop container if server is running
      if (wasRunning && conn) {
        await this.ssh.exec(conn, 'docker compose -f /opt/zomboid/docker-compose.yml down');
      }

      // 2. Stop VM
      await this.cloud.stopInstance(server.projectId, server.instanceZone, instanceName);
      vmStopped = true;

      // 3. Resize VM
      await this.cloud.changeMachineType(
        server.projectId,
        server.instanceZone,
        instanceName,
        newType.id,
      );
      machineChanged = true;

      // 4. Start VM
      await this.cloud.startInstance(server.projectId, server.instanceZone, instanceName);
      vmStarted = true;

      // 5. Update compose SERVER_MEMORY + start container
      if (conn) {
        await this.updateServerMemory(conn, newMemory);
        composeUpdated = true;
        await this.ssh.exec(conn, 'docker compose -f /opt/zomboid/docker-compose.yml up -d');
      }

      // 6. Persist new state
      await this.db.updateServer(id, {
        instanceType: newType.id,
        status: 'running',
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      await this.rollbackInstanceResize({
        server,
        instanceName,
        vmStopped,
        machineChanged,
        vmStarted,
        wasRunning,
        conn,
        originalMachineTypeId,
        originalMemory,
        composeUpdated,
      });
      throw error;
    }
  }

  // ── Private helpers ──

  private async requireServer(id: ServerId): Promise<ServerRecord> {
    const server = await this.db.getServer(id);
    if (!server) {
      throw new Error(`Server not found: ${id}`);
    }
    return server;
  }

  private requireSshConn(server: ServerRecord): SshConnectionConfig {
    if (!server.staticIp) {
      throw new Error('Cannot execute lifecycle command without static IP');
    }

    return {
      host: server.staticIp,
      port: 22,
      username: 'root',
      privateKey: server.sshPrivateKey,
    };
  }

  private instanceName(server: ServerRecord): string {
    return `zomboid-${server.name}`;
  }

  private instanceNameFromConfig(config: ServerConfig): string {
    return `zomboid-${config.name}`;
  }

  private async waitForVmBoot(
    serverId: ServerId,
    projectId: string,
    zone: string,
    instanceName: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < this.opts.vmBootMaxPollAttempts; attempt++) {
      const status = await this.cloud.getInstanceStatus(projectId, zone, instanceName);
      if (status === 'RUNNING') return;
      await this.opts.sleepFn(this.opts.pollIntervalMs);
    }
    throw new VmBootTimeoutError(serverId);
  }

  private async waitForCloudInit(
    conn: SshConnectionConfig,
    serverId: ServerId,
  ): Promise<void> {
    for (let attempt = 0; attempt < this.opts.cloudInitMaxPollAttempts; attempt++) {
      const connected = await this.ssh.testConnection(conn);
      if (connected) {
        try {
          const healthResult = await this.ssh.exec(
            conn,
            'docker compose -f /opt/zomboid/docker-compose.yml ps',
          );
          if (healthResult.stdout.includes('running')) {
            return;
          }
        } catch {
          // Keep polling until timeout.
        }
      }
      await this.opts.sleepFn(this.opts.pollIntervalMs);
    }
    throw new CloudInitTimeoutError(serverId);
  }

  private async updateServerMemory(conn: SshConnectionConfig, memory: string): Promise<void> {
    await this.ssh.exec(
      conn,
      `sed -i -E "s/SERVER_MEMORY=.*/SERVER_MEMORY=${memory}/" /opt/zomboid/docker-compose.yml`,
    );
  }

  private buildPersistedErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return String(error);
    }

    const causeMessage = error.cause instanceof Error
      ? error.cause.message.trim()
      : null;

    if (!causeMessage) {
      return error.message;
    }

    return `${error.message}: ${causeMessage}`;
  }

  private async rollbackInstanceResize(params: {
    server: ServerRecord;
    instanceName: string;
    vmStopped: boolean;
    machineChanged: boolean;
    vmStarted: boolean;
    wasRunning: boolean;
    conn: SshConnectionConfig | null;
    originalMachineTypeId: string;
    originalMemory: string | null;
    composeUpdated: boolean;
  }): Promise<void> {
    const rollbackErrors: string[] = [];

    const attempt = async (fn: () => Promise<void>, label: string) => {
      try {
        await fn();
      } catch (error) {
        rollbackErrors.push(
          `${label}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    if (params.machineChanged || params.vmStopped) {
      await attempt(
        () =>
          this.cloud.changeMachineType(
            params.server.projectId,
            params.server.instanceZone,
            params.instanceName,
            params.originalMachineTypeId,
          ),
        'revert-machine-type',
      );
    }

    if (params.vmStopped && !params.vmStarted) {
      await attempt(
        () =>
          this.cloud.startInstance(
            params.server.projectId,
            params.server.instanceZone,
            params.instanceName,
          ),
        'restart-vm',
      );
    }

    if (params.conn && params.composeUpdated && params.originalMemory) {
      await attempt(
        () => this.updateServerMemory(params.conn!, params.originalMemory!),
        'restore-compose-memory',
      );
    }

    if (params.conn && params.wasRunning) {
      await attempt(
        () => this.ssh.exec(params.conn!, 'docker compose -f /opt/zomboid/docker-compose.yml up -d').then(() => undefined),
        'restart-container',
      );
    }

    if (rollbackErrors.length > 0) {
      throw new Error(`Rollback failed: ${rollbackErrors.join(' | ')}`);
    }
  }
}
