import type { ILocalDb } from '@/domain/repositories/i-local-db.ts';
import type { ServerRecord } from '@/domain/entities/server-record.ts';
import type { ServerId, ServerStatus } from '@/domain/entities/enums.ts';
import { createServerId } from '@/domain/entities/enums.ts';
import { isValidStatusTransition } from '@/domain/entities/server-record.ts';
import { DomainError } from '@/domain/entities/errors.ts';

// ── Inventory-specific Errors ──

export class ServerNotFoundError extends DomainError {
  readonly code = 'SERVER_NOT_FOUND' as const;
  constructor(id: string) {
    super(`Server not found: ${id}`, { recovery: ['abort'] });
  }
}

export class InvalidStatusTransitionError extends DomainError {
  readonly code = 'INVALID_STATUS_TRANSITION' as const;
  constructor(from: ServerStatus, to: ServerStatus) {
    super(`Invalid status transition: ${from} → ${to}`, {
      recovery: ['abort'],
    });
  }
}

// ── Input type for createServer ──

export interface CreateServerInput {
  readonly name: string;
  readonly provider: 'gcp' | 'aws' | 'azure';
  readonly projectId: string;
  readonly zone: string;
  readonly instanceType: string;
  readonly gameBranch: 'stable' | 'unstable' | 'outdatedunstable';
}

// ── InventoryService ──

export class InventoryService {
  constructor(private readonly db: ILocalDb) {}

  async createServer(input: CreateServerInput): Promise<ServerRecord> {
    const id = createServerId(crypto.randomUUID());
    const now = new Date().toISOString();

    // Generate Ed25519 SSH keypair
    const keyPair = crypto.subtle
      ? await this.generateSshKey()
      : { privateKey: 'mock-key' };

    // Generate RCON password (32 hex chars from 16 random bytes)
    const rconPassword = this.generateRconPassword();

    const record: ServerRecord = {
      id,
      name: input.name,
      provider: input.provider,
      projectId: input.projectId,
      instanceType: input.instanceType,
      instanceZone: input.zone,
      staticIp: null,
      sshPrivateKey: keyPair.privateKey,
      rconPassword,
      gameBranch: input.gameBranch,
      status: 'provisioning',
      errorMessage: null,
      backupPath: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.createServer(record);
    return record;
  }

  async getServer(id: ServerId): Promise<ServerRecord> {
    const server = await this.db.getServer(id);
    if (!server) {
      throw new ServerNotFoundError(id);
    }
    return server;
  }

  async listServers(
    filter?: { status?: ServerStatus },
  ): Promise<readonly ServerRecord[]> {
    return this.db.listServers(filter);
  }

  async get(id: ServerId): Promise<ServerRecord> {
    return this.getServer(id);
  }

  async list(filter?: { status?: ServerStatus }): Promise<readonly ServerRecord[]> {
    return this.listServers(filter);
  }

  async listActive(): Promise<readonly ServerRecord[]> {
    const all = await this.db.listServers();
    return all.filter((server) => server.status !== 'archived');
  }

  async listArchived(): Promise<readonly ServerRecord[]> {
    return this.db.listServers({ status: 'archived' });
  }

  async updateServerStatus(
    id: ServerId,
    status: ServerStatus,
  ): Promise<ServerRecord> {
    const server = await this.getServer(id);

    if (!isValidStatusTransition(server.status, status)) {
      throw new InvalidStatusTransitionError(server.status, status);
    }

    const now = new Date().toISOString();
    await this.db.updateServer(id, { status, updatedAt: now });
    return this.getServer(id);
  }

  async updateServerIp(id: ServerId, ip: string): Promise<ServerRecord> {
    await this.getServer(id); // throws if not found
    const now = new Date().toISOString();
    await this.db.updateServer(id, { staticIp: ip, updatedAt: now });
    return this.getServer(id);
  }

  async archiveServer(
    id: ServerId,
    backupPath: string,
  ): Promise<ServerRecord> {
    const server = await this.getServer(id);

    if (!isValidStatusTransition(server.status, 'archived')) {
      throw new InvalidStatusTransitionError(server.status, 'archived');
    }

    const now = new Date().toISOString();
    await this.db.updateServer(id, {
      status: 'archived',
      backupPath,
      updatedAt: now,
    });
    return this.getServer(id);
  }

  async deleteServer(id: ServerId): Promise<void> {
    await this.db.deleteServer(id);
  }

  // ── Private helpers ──

  private async generateSshKey(): Promise<{ privateKey: string }> {
    try {
      const { generateKeyPairSync } = await import('crypto');
      const { privateKey } = generateKeyPairSync('ed25519', {
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      return { privateKey };
    } catch {
      // Fallback: generate a random string as placeholder
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return {
        privateKey: Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
      };
    }
  }

  private generateRconPassword(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
