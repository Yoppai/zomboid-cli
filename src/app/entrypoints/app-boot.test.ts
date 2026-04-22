import { expect, test, describe, afterEach } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFakeAppContext, destroyFakeAppContext } from '@/tests/helpers/fake-app-context.ts';

describe('Integration: App Boot', () => {
  let context: Awaited<ReturnType<typeof createFakeAppContext>> | null;

  afterEach(async () => {
    if (context) {
      await destroyFakeAppContext(context);
      context = null;
    }
  });

  test('app boots with :memory: db and services resolve', async () => {
    // RED: createFakeAppContext does not exist yet
    context = await createFakeAppContext({ dbPath: ':memory:' });

    // Services are available (mocked)
    expect(context.services.inventory).toBeDefined();
    expect(context.services.deploy).toBeDefined();
    expect(context.services.latency).toBeDefined();

    // Repositories include the real SQLite localDb (passed through)
    expect(context.repositories.localDb).toBeDefined();

    // Repositories are not the service (structural check)
    expect(context.repositories.localDb).not.toBe(context.services.inventory);

    await destroyFakeAppContext(context);
    context = null;
  });

  test('repositories.localDb is real SqliteLocalDb with migration defaults', async () => {
    context = await createFakeAppContext({ dbPath: ':memory:' });

    // localDb is the real SqliteLocalDb instance — it has run migrations
    const localDb = context.repositories.localDb as any;
    expect(typeof localDb.getSetting).toBe('function');
    expect(typeof localDb.setSetting).toBe('function');
    expect(typeof localDb.createServer).toBe('function');

    // Migrations set default locale to 'en'
    const locale = await localDb.getSetting('locale');
    expect(locale).toBe('en');

    await destroyFakeAppContext(context);
    context = null;
  });

  test('services.inventory uses mocked methods with safe defaults', async () => {
    context = await createFakeAppContext({ dbPath: ':memory:' });

    // Inventory mock returns empty array by default (no live network)
    const servers = await context.services.inventory.listServers();
    expect(servers).toEqual([]);

    // createServer mock is callable
    const result = await context.services.inventory.createServer({
      name: 'test-server',
      provider: 'gcp',
      projectId: 'proj-123',
      zone: 'us-east1-b',
      instanceType: 'e2-standard-2',
      gameBranch: 'stable',
    } as any);
    // Mock returns undefined; this verifies the mock is wired
    expect(result).toBeUndefined();
    expect(context.services.inventory.createServer).toHaveBeenCalled();

    await destroyFakeAppContext(context);
    context = null;
  });

  test('failed server persists across destroy/recreate with temp file db', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zomboid-cli-app-boot-'));
    const dbPath = path.join(tempDir, 'zomboid-cli-test.db');

    try {
      // Boot #1 — create a server and mark it failed
      context = await createFakeAppContext({ dbPath });
      const created = await context.services.inventory.createServer({
        name: 'failed-persisted-server',
        provider: 'gcp',
        projectId: 'proj-restart',
        zone: 'us-east1-b',
        instanceType: 'e2-standard-2',
        gameBranch: 'stable',
      } as any);

      // Use the real localDb to inject a failed server record directly
      const localDb = context.repositories.localDb as any;
      await localDb.createServer({
        id: 'srv-fail-persist',
        name: 'failed-persisted-server',
        provider: 'gcp',
        projectId: 'proj-restart',
        instanceType: 'e2-standard-2',
        instanceZone: 'us-east1-b',
        staticIp: null,
        sshPrivateKey: 'fake',
        rconPassword: 'fake',
        gameBranch: 'stable',
        status: 'failed',
        errorMessage: null,
        backupPath: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await destroyFakeAppContext(context);
      context = null;

      // Boot #2 — verify failed server is still in the real database
      context = await createFakeAppContext({ dbPath });
      const servers = await context.repositories.localDb.listServers!() as any[];
      const failedServer = servers.find((s: any) => s.name === 'failed-persisted-server');
      expect(failedServer).toBeDefined();
      expect(failedServer?.status).toBe('failed');
    } finally {
      if (context) {
        await destroyFakeAppContext(context);
        context = null;
      }
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Windows SQLite handle may remain briefly locked
      }
    }
  });
});
