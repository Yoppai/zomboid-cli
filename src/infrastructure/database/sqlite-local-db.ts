import { Database } from 'bun:sqlite';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { ILocalDb } from '../../domain/repositories/i-local-db.ts';
import type { ServerRecord } from '../../domain/entities/server-record.ts';
import type { ScheduledTask } from '../../domain/entities/scheduled-task.ts';
import type { ServerId, TaskId, ServerStatus } from '../../domain/entities/enums.ts';
import { createServerId, createTaskId } from '../../domain/entities/enums.ts';
import type { SettingKey } from '../../domain/entities/setting.ts';
import { isValidStatusTransition } from '../../domain/entities/server-record.ts';
import { runMigrations } from './migrations.ts';

// ── Helpers ──

function resolveHome(pathStr: string): string {
  if (pathStr.startsWith('~')) {
    return path.join(os.homedir(), pathStr.slice(1));
  }
  return pathStr;
}

// ── SQLite Row Types ──

interface ServerRow {
  id: string;
  name: string;
  provider: string;
  project_id: string;
  instance_type: string;
  instance_zone: string;
  static_ip: string | null;
  ssh_private_key: string;
  rcon_password: string;
  game_branch: string;
  status: string;
  error_message: string | null;
  backup_path: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  id: string;
  server_id: string;
  type: string;
  cron_expression: string;
  payload: string | null;
  enabled: number;
  created_at: string;
}

interface SettingRow {
  key: string;
  value: string;
}

// ── Row → Entity Mappers (pure functions) ──

function rowToServer(row: ServerRow): ServerRecord {
  return {
    id: createServerId(row.id),
    name: row.name,
    provider: row.provider as ServerRecord['provider'],
    projectId: row.project_id,
    instanceType: row.instance_type,
    instanceZone: row.instance_zone,
    staticIp: row.static_ip,
    sshPrivateKey: row.ssh_private_key,
    rconPassword: row.rcon_password,
    gameBranch: row.game_branch as ServerRecord['gameBranch'],
    status: row.status as ServerStatus,
    errorMessage: row.error_message,
    backupPath: row.backup_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTask(row: TaskRow): ScheduledTask {
  return {
    id: createTaskId(row.id),
    serverId: createServerId(row.server_id),
    type: row.type as ScheduledTask['type'],
    cronExpression: row.cron_expression,
    payload: row.payload,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

// ── Default Settings ──

const DEFAULT_SETTINGS: ReadonlyArray<{ key: SettingKey; value: string }> = [
  { key: 'locale', value: 'en' },
  { key: 'backup_path', value: '~/.zomboid-cli/backups' },
];

// ── SqliteLocalDb Adapter ──

export class SqliteLocalDb implements ILocalDb {
  private readonly db: Database;

  constructor(dbPath: string = '~/.zomboid-cli/zomboid-cli.db') {
    const resolvedPath = resolveHome(dbPath);
    
    // Ensure parent directory exists
    if (resolvedPath !== ':memory:') {
      const parentDir = path.dirname(resolvedPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
    }

    this.db = new Database(resolvedPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    runMigrations(this.db);
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const upsert = this.db.prepare(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    );
    for (const { key, value } of DEFAULT_SETTINGS) {
      upsert.run(key, value);
    }
  }

  // ── Server CRUD ──

  async createServer(server: ServerRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO servers (id, name, provider, project_id, instance_type, instance_zone, static_ip, ssh_private_key, rcon_password, game_branch, status, error_message, backup_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        String(server.id),
        server.name,
        server.provider,
        server.projectId,
        server.instanceType,
        server.instanceZone,
        server.staticIp,
        server.sshPrivateKey,
        server.rconPassword,
        server.gameBranch,
        server.status,
        server.errorMessage,
        server.backupPath,
        server.createdAt,
        server.updatedAt,
      );
  }

  async getServer(id: ServerId): Promise<ServerRecord | null> {
    const row = this.db
      .query<ServerRow, [string]>('SELECT * FROM servers WHERE id = ?')
      .get(String(id));
    return row ? rowToServer(row) : null;
  }

  async listServers(filter?: { status?: ServerStatus }): Promise<readonly ServerRecord[]> {
    if (filter?.status) {
      return this.db
        .query<ServerRow, [string]>('SELECT * FROM servers WHERE status = ?')
        .all(filter.status)
        .map(rowToServer);
    }
    return this.db
      .query<ServerRow, []>('SELECT * FROM servers')
      .all()
      .map(rowToServer);
  }

  async updateServer(
    id: ServerId,
    fields: Partial<
      Pick<
        ServerRecord,
        'status' | 'errorMessage' | 'backupPath' | 'staticIp' | 'instanceType' | 'gameBranch' | 'updatedAt'
      >
    >,
  ): Promise<void> {
    // Validate status transition if status is being changed
    if (fields.status !== undefined) {
      const current = await this.getServer(id);
      if (current && !isValidStatusTransition(current.status, fields.status)) {
        throw new Error(
          `Cannot transition from '${current.status}' to '${fields.status}'`,
        );
      }
    }

    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    if (fields.status !== undefined) {
      setClauses.push('status = ?');
      values.push(fields.status);
    }
    if (fields.errorMessage !== undefined) {
      setClauses.push('error_message = ?');
      values.push(fields.errorMessage);
    }
    if (fields.backupPath !== undefined) {
      setClauses.push('backup_path = ?');
      values.push(fields.backupPath);
    }
    if (fields.staticIp !== undefined) {
      setClauses.push('static_ip = ?');
      values.push(fields.staticIp);
    }
    if (fields.instanceType !== undefined) {
      setClauses.push('instance_type = ?');
      values.push(fields.instanceType);
    }
    if (fields.gameBranch !== undefined) {
      setClauses.push('game_branch = ?');
      values.push(fields.gameBranch);
    }
    if (fields.updatedAt !== undefined) {
      setClauses.push('updated_at = ?');
      values.push(fields.updatedAt);
    }

    if (setClauses.length === 0) return;

    values.push(String(id));
    this.db
      .prepare(`UPDATE servers SET ${setClauses.join(', ')} WHERE id = ?`)
      .run(...values);
  }

  async deleteServer(id: ServerId): Promise<void> {
    this.db.prepare('DELETE FROM servers WHERE id = ?').run(String(id));
  }

  // ── Scheduled Tasks CRUD ──

  async createTask(task: ScheduledTask): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO scheduled_tasks (id, server_id, type, cron_expression, payload, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        String(task.id),
        String(task.serverId),
        task.type,
        task.cronExpression,
        task.payload,
        task.enabled ? 1 : 0,
        task.createdAt,
      );
  }

  async getTask(id: TaskId): Promise<ScheduledTask | null> {
    const row = this.db
      .query<TaskRow, [string]>('SELECT * FROM scheduled_tasks WHERE id = ?')
      .get(String(id));
    return row ? rowToTask(row) : null;
  }

  async listTasks(serverId: ServerId): Promise<readonly ScheduledTask[]> {
    return this.db
      .query<TaskRow, [string]>('SELECT * FROM scheduled_tasks WHERE server_id = ?')
      .all(String(serverId))
      .map(rowToTask);
  }

  async updateTask(
    id: TaskId,
    fields: Partial<Pick<ScheduledTask, 'cronExpression' | 'payload' | 'enabled'>>,
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    if (fields.cronExpression !== undefined) {
      setClauses.push('cron_expression = ?');
      values.push(fields.cronExpression);
    }
    if (fields.payload !== undefined) {
      setClauses.push('payload = ?');
      values.push(fields.payload);
    }
    if (fields.enabled !== undefined) {
      setClauses.push('enabled = ?');
      values.push(fields.enabled ? 1 : 0);
    }

    if (setClauses.length === 0) return;

    values.push(String(id));
    this.db
      .prepare(`UPDATE scheduled_tasks SET ${setClauses.join(', ')} WHERE id = ?`)
      .run(...values);
  }

  async deleteTask(id: TaskId): Promise<void> {
    this.db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(String(id));
  }

  async deleteTasksByServer(serverId: ServerId): Promise<void> {
    this.db
      .prepare('DELETE FROM scheduled_tasks WHERE server_id = ?')
      .run(String(serverId));
  }

  // ── Settings ──

  async getSetting(key: SettingKey): Promise<string | null> {
    const row = this.db
      .query<SettingRow, [string]>('SELECT * FROM settings WHERE key = ?')
      .get(key);
    return row ? row.value : null;
  }

  async setSetting(key: SettingKey, value: string): Promise<void> {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value);
  }

  // ── Lifecycle ──

  close(): void {
    this.db.close();
  }
}
