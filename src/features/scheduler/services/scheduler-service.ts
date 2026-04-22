import type { ISshGateway } from '@/shared/infra/contracts/i-ssh-gateway.ts';
import type { ILocalDb } from '@/shared/infra/contracts/i-local-db.ts';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { ScheduledTask } from '@/shared/infra/entities/scheduled-task.ts';
import type { ServerId, TaskId, TaskType } from '@/shared/infra/entities/enums.ts';
import type { SshConnectionConfig } from '@/shared/infra/entities/value-objects.ts';
import { createTaskId } from '@/shared/infra/entities/enums.ts';

// ── Cron Validation ──

const CRON_RANGES: readonly [number, number][] = [
  [0, 59],  // minute
  [0, 23],  // hour
  [1, 31],  // day of month
  [1, 12],  // month
  [0, 7],   // day of week (0 and 7 = Sunday)
];

export function validateCron(
  expression: string,
): { valid: boolean; error?: string } {
  if (!expression || !expression.trim()) {
    return { valid: false, error: 'Cron expression cannot be empty' };
  }

  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return {
      valid: false,
      error: `Expected 5 fields, got ${fields.length}`,
    };
  }

  for (let i = 0; i < 5; i++) {
    const field = fields[i]!;
    const [min, max] = CRON_RANGES[i]!;

    // Allow *, */N, N, N-N, N,N,...
    if (field === '*') continue;

    // Handle */N
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10);
      if (isNaN(step) || step < 1 || step > max) {
        return { valid: false, error: `Invalid step value in field ${i + 1}: ${field}` };
      }
      continue;
    }

    // Handle comma-separated values and ranges
    const parts = field.split(',');
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (isNaN(start!) || isNaN(end!) || start! < min || end! > max || start! > end!) {
          return { valid: false, error: `Invalid range in field ${i + 1}: ${part}` };
        }
      } else {
        const val = parseInt(part, 10);
        if (isNaN(val) || val < min || val > max) {
          return { valid: false, error: `Value out of range in field ${i + 1}: ${part} (${min}-${max})` };
        }
      }
    }
  }

  return { valid: true };
}

// ── Crontab Line Generation (pure function) ──

export function generateCrontabLine(task: ScheduledTask): string {
  const cron = task.cronExpression;

  switch (task.type) {
    case 'auto_restart':
      return `${cron} docker compose -f /opt/zomboid/docker-compose.yml restart`;

    case 'auto_backup':
      return `${cron} tar -czf /tmp/zomboid-auto-backup-$(date +\\%Y\\%m\\%d-\\%H\\%M\\%S).tar.gz -C /opt/zomboid/data .`;

    case 'broadcast':
      return `${cron} echo 'servermsg "${task.payload ?? ''}"' | docker exec -i zomboid-server rcon-cli`;

    default:
      return `${cron} echo "Unknown task type: ${task.type}"`;
  }
}

// ── SchedulerService ──

export class SchedulerService {
  constructor(
    private readonly ssh: ISshGateway,
    private readonly db: ILocalDb,
  ) {}

  /**
   * Add a new scheduled task: saves to SQLite + installs crontab entry on VM via SSH.
   */
  async addTask(
    server: ServerRecord,
    taskInput: Omit<ScheduledTask, 'id' | 'createdAt'>,
  ): Promise<ScheduledTask> {
    const task: ScheduledTask = {
      ...taskInput,
      id: createTaskId(crypto.randomUUID()),
      createdAt: new Date().toISOString(),
    };

    // Persist to database
    await this.db.createTask(task);

    // Install crontab entry on VM
    await this.syncCrontab(server);

    return task;
  }

  /**
   * Remove a scheduled task: deletes from SQLite + syncs crontab.
   */
  async removeTask(server: ServerRecord, taskId: TaskId): Promise<void> {
    await this.db.deleteTask(taskId);
    await this.syncCrontab(server);
  }

  /**
   * List all tasks for a server from SQLite.
   */
  async listTasks(serverId: ServerId): Promise<readonly ScheduledTask[]> {
    return this.db.listTasks(serverId);
  }

  /**
   * Toggle task enabled/disabled: updates SQLite + syncs crontab.
   */
  async toggleTask(
    server: ServerRecord,
    taskId: TaskId,
    enabled: boolean,
  ): Promise<void> {
    await this.db.updateTask(taskId, { enabled });
    await this.syncCrontab(server);
  }

  /**
   * Rebuild full crontab on VM from all enabled tasks for this server.
   */
  async syncCrontab(server: ServerRecord): Promise<void> {
    const conn = this.sshConn(server);
    const tasks = await this.db.listTasks(server.id);

    // Filter enabled tasks only and generate crontab lines
    const enabledTasks = tasks.filter((t) => t.enabled);
    const lines = enabledTasks.map((t) => generateCrontabLine(t));

    // Build the crontab content
    const crontabContent = lines.join('\n');

    // Install via SSH — echo into crontab
    if (crontabContent.length > 0) {
      await this.ssh.exec(
        conn,
        `echo "${crontabContent}" | crontab -`,
      );
    } else {
      // Clear crontab
      await this.ssh.exec(conn, 'echo "" | crontab -');
    }
  }

  // ── Private helpers ──

  private sshConn(server: ServerRecord): SshConnectionConfig {
    return {
      host: server.staticIp ?? '',
      port: 22,
      username: 'root',
      privateKey: server.sshPrivateKey,
    };
  }
}
