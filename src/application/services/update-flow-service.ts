import type { ISshGateway } from '@/domain/repositories/i-ssh-gateway.ts';
import type { ILocalDb } from '@/domain/repositories/i-local-db.ts';
import type { ServerId } from '@/domain/entities/enums.ts';
import type { SshConnectionConfig } from '@/domain/entities/value-objects.ts';
import type { ServerRecord } from '@/domain/entities/server-record.ts';
import { RconService } from '@/application/services/rcon-service.ts';
import type { BackupService } from '@/application/services/backup-service.ts';

// ── Options (injectable for testing) ──

export interface UpdateFlowOptions {
  readonly delayFn: (ms: number) => Promise<void>;
}

const DEFAULT_OPTIONS: UpdateFlowOptions = {
  delayFn: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// ── UpdateFlowService ──

export class UpdateFlowService {
  private readonly opts: UpdateFlowOptions;
  private static readonly PULL_CMD =
    'docker compose -f /opt/zomboid/docker-compose.yml pull';
  private static readonly UP_CMD =
    'docker compose -f /opt/zomboid/docker-compose.yml up -d';

  constructor(
    private readonly rcon: RconService,
    private readonly ssh: ISshGateway,
    private readonly db: ILocalDb,
    private readonly backup: BackupService,
    opts?: Partial<UpdateFlowOptions>,
  ) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  /**
   * Graceful update flow:
   * 1. Broadcast warning to players
   * 2. Wait warningSeconds
   * 3. Save world
   * 4. Graceful quit
   * 5. Docker compose pull && up -d
   * 6. Health check
   * 7. Update status to running
   */
  async gracefulUpdate(
    serverId: ServerId,
    warningSeconds: number = 60,
  ): Promise<void> {
    const server = await this.requireServer(serverId);
    const conn = this.sshConn(server);

    // 0. Pre-update backup (atomicity gate)
    try {
      await this.backup.create(serverId);
    } catch (err) {
      throw new Error(
        `Pre-update backup failed: ${this.describeError(err)}`,
      );
    }

    // 1. Broadcast warning
    await this.rcon.broadcast(
      `Server updating in ${warningSeconds}s...`,
    );

    // 2. Wait
    await this.opts.delayFn(warningSeconds * 1000);

    // 3. Save world
    await this.rcon.save();

    // 4. Graceful quit
    await this.rcon.quit();

    // 5. Pull new image
    try {
      await this.ssh.exec(conn, UpdateFlowService.PULL_CMD);
    } catch (pullErr) {
      const pullReason = this.describeError(pullErr);

      // Pull failed — attempt rollback restart to keep previous container running.
      let rollbackReason: string | null = null;
      try {
        await this.ssh.exec(conn, UpdateFlowService.UP_CMD);

        // Rollback succeeded, server remains running.
        await this.db.updateServer(serverId, {
          status: 'running',
          updatedAt: new Date().toISOString(),
        });
      } catch (rollbackErr) {
        rollbackReason = this.describeError(rollbackErr);
      }

      if (rollbackReason) {
        await this.db.updateServer(serverId, {
          status: 'failed',
          errorMessage: `Update pull failed: ${pullReason}. Rollback failed: ${rollbackReason}`,
          updatedAt: new Date().toISOString(),
        });

        throw new Error(
          `Docker compose pull failed: ${pullReason}. Rollback restart failed: ${rollbackReason}`,
        );
      }

      throw new Error(`Docker compose pull failed: ${pullReason}`);
    }

    // 5b. Restart with updated image
    await this.ssh.exec(conn, UpdateFlowService.UP_CMD);

    // 6. Health check
    await this.ssh.exec(
      conn,
      'docker compose -f /opt/zomboid/docker-compose.yml ps',
    );

    // 7. Update status
    await this.db.updateServer(serverId, {
      status: 'running',
      updatedAt: new Date().toISOString(),
    });
  }

  private describeError(err: unknown): string {
    if (err instanceof Error && err.message.length > 0) {
      return err.message;
    }
    return String(err);
  }

  /**
   * Quick restart: no warning, just save → quit → restart
   */
  async quickRestart(serverId: ServerId): Promise<void> {
    const server = await this.requireServer(serverId);
    const conn = this.sshConn(server);

    // Save + quit
    await this.rcon.save();
    await this.rcon.quit();

    // Restart
    await this.ssh.exec(
      conn,
      'docker compose -f /opt/zomboid/docker-compose.yml up -d',
    );

    // Update status
    await this.db.updateServer(serverId, {
      status: 'running',
      updatedAt: new Date().toISOString(),
    });
  }

  // ── Private helpers ──

  private async requireServer(id: ServerId): Promise<ServerRecord> {
    const server = await this.db.getServer(id);
    if (!server) {
      throw new Error(`Server not found: ${id}`);
    }
    return server;
  }

  private sshConn(server: ServerRecord): SshConnectionConfig {
    return {
      host: server.staticIp ?? '',
      port: 22,
      username: 'root',
      privateKey: server.sshPrivateKey,
    };
  }
}
