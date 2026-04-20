/**
 * Phase 2 Task 2.4 — tests/helpers/fake-app-context.ts
 *
 * Disposable app context factory for integration tests.
 *
 * Uses real SqliteLocalDb with :memory: (no filesystem, no credentials) but
 * replaces all external infrastructure (SSH, RCON, cloud) with no-op fakes.
 * Tests get a fully-functional context where services use real business logic
 * but infrastructure calls go to mocks.
 *
 * Usage:
 *   const ctx = await createFakeAppContext({ dbPath: ':memory:' });
 *   const servers = await ctx.services.inventory.listServers();
 *   await destroyFakeAppContext(ctx);
 */
import { SqliteLocalDb } from '@/infrastructure/database/sqlite-local-db.ts';
import { createMockServices, type MockServices } from '@/tests/helpers/mock-services.ts';

export type FakeAppContext = {
  services: MockServices['services'];
  repositories: MockServices['repositories'];
};

/**
 * createFakeAppContext — boot a disposable app context with real SQLite and mocked infra.
 *
 * @param options.dbPath - SQLite path. Defaults to ':memory:' for isolation.
 */
export async function createFakeAppContext(options: { dbPath?: string } = {}) {
  const { dbPath = ':memory:' } = options;
  const mocks = createMockServices();

  // Replace the in-memory localDb with a real one (keeping mock methods for any
  // tests that override, but SqliteLocalDb itself handles real persistence)
  const localDb = new SqliteLocalDb(dbPath);

  return {
    services: mocks.services,
    repositories: {
      ...mocks.repositories,
      localDb: localDb as unknown as MockServices['repositories']['localDb'],
    },
  };
}

/**
 * destroyFakeAppContext — clean up resources created by createFakeAppContext.
 *
 * Closes the SQLite connection and releases SSH pool.
 */
export async function destroyFakeAppContext(context: FakeAppContext): Promise<void> {
  try {
    if (context?.repositories?.localDb?.close) {
      context.repositories.localDb.close();
    }
  } catch {
    // ignore close errors
  }

  try {
    if (context?.repositories?.sshGateway?.disconnectAll) {
      await context.repositories.sshGateway.disconnectAll();
    }
  } catch {
    // ignore release errors
  }
}
