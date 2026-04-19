import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';

// Production code that does NOT exist yet — guarantees RED
import { runMigrations, MIGRATIONS, type Migration } from '../../../src/infrastructure/database/migrations.ts';

describe('SQLite Migrations', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  describe('MIGRATIONS array', () => {
    it('should have at least one migration', () => {
      expect(MIGRATIONS.length).toBeGreaterThanOrEqual(1);
    });

    it('should have version 1 that creates servers, scheduled_tasks, settings, and _migrations tables', () => {
      const v1 = MIGRATIONS.find((m) => m.version === 1);
      expect(v1).toBeDefined();
      expect(v1!.description).toContain('servers');
    });

    it('should have sequential version numbers starting from 1', () => {
      for (let i = 0; i < MIGRATIONS.length; i++) {
        expect(MIGRATIONS[i]!.version).toBe(i + 1);
      }
    });
  });

  describe('runMigrations', () => {
    it('should create all 4 tables on first run', () => {
      runMigrations(db);

      const tables = db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .all()
        .map((r) => r.name);

      expect(tables).toContain('servers');
      expect(tables).toContain('scheduled_tasks');
      expect(tables).toContain('settings');
      expect(tables).toContain('_migrations');
    });

    it('should record applied version in _migrations table', () => {
      runMigrations(db);

      const versions = db
        .query<{ version: number }, []>('SELECT version FROM _migrations ORDER BY version')
        .all()
        .map((r) => r.version);

      expect(versions).toContain(1);
    });

    it('should be idempotent — re-running does not error', () => {
      runMigrations(db);
      // Second run should be a no-op
      expect(() => runMigrations(db)).not.toThrow();

      const versions = db
        .query<{ version: number }, []>('SELECT version FROM _migrations')
        .all();

      // Only one version 1 entry, not duplicated
      expect(versions.filter((v) => v.version === 1)).toHaveLength(1);
    });

    it('should only run pending migrations (skip already applied)', () => {
      runMigrations(db);

      // Manually insert a version 1 tracking row is already there
      // Run again — should not re-run version 1
      const countBefore = db
        .query<{ cnt: number }, []>('SELECT COUNT(*) as cnt FROM _migrations')
        .get()!.cnt;

      runMigrations(db);

      const countAfter = db
        .query<{ cnt: number }, []>('SELECT COUNT(*) as cnt FROM _migrations')
        .get()!.cnt;

      expect(countAfter).toBe(countBefore);
    });

    it('should rollback on migration failure and NOT advance version', () => {
      // Run version 1 first (valid)
      runMigrations(db);

      // Create a failing migration
      const failingMigrations: Migration[] = [
        ...MIGRATIONS,
        {
          version: 2,
          description: 'Intentional failure',
          up: (_db) => {
            _db.exec('CREATE TABLE test_rollback (id TEXT)');
            // This will fail — referencing nonexistent table
            _db.exec('INSERT INTO nonexistent_table VALUES (1)');
          },
        },
      ];

      // This should catch internally and not advance
      expect(() => runMigrations(db, failingMigrations)).toThrow();

      // Version 2 should NOT be recorded
      const versions = db
        .query<{ version: number }, []>('SELECT version FROM _migrations')
        .all()
        .map((r) => r.version);

      expect(versions).not.toContain(2);

      // test_rollback table should NOT exist (rolled back)
      const tables = db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='test_rollback'",
        )
        .all();
      expect(tables).toHaveLength(0);
    });

    it('should create servers table with correct columns', () => {
      runMigrations(db);

      const columns = db
        .query<{ name: string }, []>("PRAGMA table_info('servers')")
        .all()
        .map((c) => c.name);

      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('provider');
      expect(columns).toContain('project_id');
      expect(columns).toContain('instance_type');
      expect(columns).toContain('instance_zone');
      expect(columns).toContain('static_ip');
      expect(columns).toContain('ssh_private_key');
      expect(columns).toContain('rcon_password');
      expect(columns).toContain('game_branch');
      expect(columns).toContain('status');
      expect(columns).toContain('error_message');
      expect(columns).toContain('backup_path');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should create scheduled_tasks table with correct columns', () => {
      runMigrations(db);

      const columns = db
        .query<{ name: string }, []>("PRAGMA table_info('scheduled_tasks')")
        .all()
        .map((c) => c.name);

      expect(columns).toContain('id');
      expect(columns).toContain('server_id');
      expect(columns).toContain('type');
      expect(columns).toContain('cron_expression');
      expect(columns).toContain('payload');
      expect(columns).toContain('enabled');
      expect(columns).toContain('created_at');
    });

    it('should create settings table with correct columns', () => {
      runMigrations(db);

      const columns = db
        .query<{ name: string }, []>("PRAGMA table_info('settings')")
        .all()
        .map((c) => c.name);

      expect(columns).toContain('key');
      expect(columns).toContain('value');
    });

    it('should enforce unique constraint on servers.name', () => {
      runMigrations(db);

      db.exec(`
        INSERT INTO servers (id, name, provider, project_id, instance_type, instance_zone, ssh_private_key, rcon_password, game_branch, status, created_at, updated_at)
        VALUES ('srv-1', 'alpha', 'gcp', 'proj', 'e2', 'us-a', 'key', 'pass', 'stable', 'running', '2026-01-01', '2026-01-01')
      `);

      expect(() =>
        db.exec(`
          INSERT INTO servers (id, name, provider, project_id, instance_type, instance_zone, ssh_private_key, rcon_password, game_branch, status, created_at, updated_at)
          VALUES ('srv-2', 'alpha', 'gcp', 'proj', 'e2', 'us-a', 'key', 'pass', 'stable', 'running', '2026-01-01', '2026-01-01')
        `),
      ).toThrow();
    });
  });
});
