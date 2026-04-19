import { Database } from 'bun:sqlite';

// ── Migration Type ──

export interface Migration {
  readonly version: number;
  readonly description: string;
  readonly up: (db: Database) => void;
}

// ── Migrations Array ──

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Initial schema: servers, scheduled_tasks, settings',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS servers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          provider TEXT NOT NULL,
          project_id TEXT NOT NULL,
          instance_type TEXT NOT NULL,
          instance_zone TEXT NOT NULL,
          static_ip TEXT,
          ssh_private_key TEXT NOT NULL,
          rcon_password TEXT NOT NULL,
          game_branch TEXT NOT NULL DEFAULT 'stable',
          status TEXT NOT NULL,
          error_message TEXT,
          backup_path TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
          id TEXT PRIMARY KEY,
          server_id TEXT NOT NULL REFERENCES servers(id),
          type TEXT NOT NULL,
          cron_expression TEXT NOT NULL,
          payload TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
    },
  },
];

// ── Migration Runner ──

export function runMigrations(
  db: Database,
  migrations: readonly Migration[] = MIGRATIONS,
): void {
  // Ensure _migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  // Read already-applied versions
  const applied = new Set(
    db
      .query<{ version: number }, []>('SELECT version FROM _migrations')
      .all()
      .map((r) => r.version),
  );

  // Run pending migrations in order
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    // Wrap in transaction for atomicity
    const transaction = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)').run(
        migration.version,
        new Date().toISOString(),
      );
    });

    transaction();
  }
}
