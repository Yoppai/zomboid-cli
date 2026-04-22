import type { ICloudProvider } from '@/shared/infra/contracts/i-cloud-provider.ts';
import type { ILocalDb } from '@/shared/infra/contracts/i-local-db.ts';
import type { ServerId } from '@/shared/infra/entities/enums.ts';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import { CdktfDestroyError } from '@/shared/infra/entities/errors.ts';
import { BackupService } from '@/features/backups/services/backup-service.ts';

// ── ArchiveService ──

export class ArchiveService {
  constructor(
    private readonly backup: BackupService,
    private readonly cloud: ICloudProvider,
    private readonly db: ILocalDb,
  ) {}

  /**
   * Archive a server — atomic flow:
   * 1. Mandatory backup (MUST succeed before destruction)
   * 2. Destroy cloud infrastructure (CDKTF destroy)
   * 3. Update status to 'archived' with backup path
   * 4. Disable all scheduled tasks
   *
   * If backup fails → ABORT, server stays unchanged.
   * If destroy fails → set status='failed', backup already created.
   */
  async archive(serverId: ServerId): Promise<{ backupPath: string }> {
    const server = await this.requireServer(serverId);

    // 1. Mandatory backup — if this fails, ABORT entirely
    const backupMeta = await this.backup.create(serverId);

    // 2. Destroy cloud infrastructure
    const destroyResult = await this.cloud.destroy(
      serverId,
      `zomboid-cli-tfstate-${server.projectId}`,
      server.projectId,
    );

    if (!destroyResult.success) {
      // Destroy failed — set status to 'failed', preserve backup
      await this.db.updateServer(serverId, {
        status: 'failed',
        errorMessage: destroyResult.error ?? 'Infrastructure destruction failed',
        updatedAt: new Date().toISOString(),
      });
      throw new CdktfDestroyError(
        new Error(destroyResult.error ?? 'Infrastructure destruction failed'),
      );
    }

    // 3. Update status to 'archived' with backup path
    await this.db.updateServer(serverId, {
      status: 'archived',
      backupPath: backupMeta.localPath,
      updatedAt: new Date().toISOString(),
    });

    // 4. Disable all scheduled tasks (retain history)
    const tasks = await this.db.listTasks(serverId);
    await Promise.all(
      tasks.map((task) => this.db.updateTask(task.id, { enabled: false })),
    );

    return { backupPath: backupMeta.localPath };
  }

  // ── Private helpers ──

  private async requireServer(id: ServerId): Promise<ServerRecord> {
    const server = await this.db.getServer(id);
    if (!server) {
      throw new Error(`Server not found: ${id}`);
    }
    return server;
  }
}
