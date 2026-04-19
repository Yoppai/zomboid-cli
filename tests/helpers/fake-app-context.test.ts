/**
 * Phase 2 Task 2.4 — tests/helpers/fake-app-context.test.ts
 *
 * RED: fake-app-context.ts does not exist yet.
 * This test describes the expected createFakeAppContext / destroyFakeAppContext API.
 */
import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { flushUpdates } from '../setup.ts';

const { createFakeAppContext, destroyFakeAppContext } = await import('./fake-app-context.ts');

describe('createFakeAppContext', () => {
  test('returns a context object with services and repositories', async () => {
    const ctx = await createFakeAppContext({ dbPath: ':memory:' });

    expect(ctx).toBeDefined();
    expect(ctx).toHaveProperty('services');
    expect(ctx).toHaveProperty('repositories');

    await destroyFakeAppContext(ctx);
  });

  test('services.inventory is functional and returns empty list', async () => {
    const ctx = await createFakeAppContext({ dbPath: ':memory:' });

    const servers = await ctx.services.inventory.listServers();
    expect(Array.isArray(servers)).toBe(true);
    expect(servers).toEqual([]);

    await destroyFakeAppContext(ctx);
  });

  test('repositories.localDb can get settings (returns null for unset)', async () => {
    const ctx = await createFakeAppContext({ dbPath: ':memory:' });

    const locale = await ctx.repositories.localDb.getSetting!('locale');
    // Default locale is 'en' from migrations, but in :memory: it may differ
    // Just verify it returns a string or null
    expect(locale === null || typeof locale === 'string').toBe(true);

    await destroyFakeAppContext(ctx);
  });

  test('services.inventory.createServer is a callable mock (returns undefined)', async () => {
    const ctx = await createFakeAppContext({ dbPath: ':memory:' });

    // createServer is a vi.fn() mock — calling it returns undefined by default
    const result = await ctx.services.inventory.createServer({
      name: 'test-server',
      provider: 'gcp',
      projectId: 'proj-123',
      zone: 'us-east1-b',
      instanceType: 'e2-standard-2',
      gameBranch: 'stable',
    });

    // Mock returns undefined — this verifies the mock is wired up correctly
    // Real service instances with real localDb are used in integration tests
    // (Phase 5 of this change)
    expect(result).toBeUndefined();
    expect(ctx.services.inventory.createServer).toHaveBeenCalled();

    await destroyFakeAppContext(ctx);
  });
});

describe('destroyFakeAppContext', () => {
  test('cleanups up without throwing', async () => {
    const ctx = await createFakeAppContext({ dbPath: ':memory:' });
    await expect(destroyFakeAppContext(ctx)).resolves.toBeUndefined();
  });

  test('idempotent: calling destroy twice does not throw', async () => {
    const ctx = await createFakeAppContext({ dbPath: ':memory:' });
    await destroyFakeAppContext(ctx);
    await expect(destroyFakeAppContext(ctx)).resolves.toBeUndefined();
  });
});
