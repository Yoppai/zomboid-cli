import type { ServerId, TaskId, ServerStatus, TaskType } from '../entities/enums.ts';
import type { ServerRecord } from '../entities/server-record.ts';
import type { ScheduledTask } from '../entities/scheduled-task.ts';
import type { SettingKey } from '../entities/setting.ts';

// ── Local Database Port ──

export interface ILocalDb {
  // ── Server CRUD ──
  createServer(server: ServerRecord): Promise<void>;
  getServer(id: ServerId): Promise<ServerRecord | null>;
  listServers(filter?: { status?: ServerStatus }): Promise<readonly ServerRecord[]>;
  updateServer(
    id: ServerId,
    fields: Partial<
      Pick<
        ServerRecord,
        | 'status'
        | 'errorMessage'
        | 'backupPath'
        | 'staticIp'
        | 'instanceType'
        | 'gameBranch'
        | 'updatedAt'
      >
    >,
  ): Promise<void>;
  deleteServer(id: ServerId): Promise<void>;

  // ── Scheduled Tasks CRUD ──
  createTask(task: ScheduledTask): Promise<void>;
  getTask(id: TaskId): Promise<ScheduledTask | null>;
  listTasks(serverId: ServerId): Promise<readonly ScheduledTask[]>;
  updateTask(
    id: TaskId,
    fields: Partial<Pick<ScheduledTask, 'cronExpression' | 'payload' | 'enabled'>>,
  ): Promise<void>;
  deleteTask(id: TaskId): Promise<void>;
  deleteTasksByServer(serverId: ServerId): Promise<void>;

  // ── Settings ──
  getSetting(key: SettingKey): Promise<string | null>;
  setSetting(key: SettingKey, value: string): Promise<void>;

  // ── Lifecycle ──
  close(): void;
}
