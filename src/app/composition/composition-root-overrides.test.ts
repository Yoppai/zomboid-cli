/**
 * Phase 3 Task 3.2 — tests/composition-root-overrides.test.ts
 *
 * RED: createAppContext does not accept overrides yet.
 * This test verifies the override seam in composition-root.ts.
 */
import { expect, test, describe, vi, beforeEach, afterEach } from 'bun:test';
import { createAppContext, destroyAppContext } from '@/app/composition/composition-root.ts';

describe('createAppContext with overrides', () => {
  let context: any;

  afterEach(async () => {
    if (context) {
      await destroyAppContext(context);
      context = null;
    }
  });

  test('accepts optional service overrides', async () => {
    const fakeLocalDb = {
      listServers: vi.fn().mockResolvedValue([{ id: 'test-srv' }]),
      getSetting: vi.fn().mockResolvedValue('en'),
      close: vi.fn(),
    };

    context = await createAppContext(
      { dbPath: ':memory:' },
      {
        repositories: {
          localDb: fakeLocalDb,
        },
      },
    );

    // The override should be used, not the real SqliteLocalDb
    const servers = await context.repositories.localDb.listServers();
    expect(servers).toEqual([{ id: 'test-srv' }]);
    expect(fakeLocalDb.listServers).toHaveBeenCalled();
  });

  test('accepts optional service method overrides', async () => {
    const fakeInventory = {
      listServers: vi.fn().mockResolvedValue([{ id: 'override-srv' }]),
    };

    context = await createAppContext(
      { dbPath: ':memory:' },
      {
        services: {
          inventory: fakeInventory,
        },
      },
    );

    const servers = await context.services.inventory.listServers();
    expect(servers).toEqual([{ id: 'override-srv' }]);
    expect(fakeInventory.listServers).toHaveBeenCalled();
  });

  test('without overrides, uses real SqliteLocalDb', async () => {
    context = await createAppContext({ dbPath: ':memory:' });

    // Real localDb should have real methods
    const servers = await context.repositories.localDb.listServers();
    expect(Array.isArray(servers)).toBe(true);
  });

  test('close is called on destroyAppContext for overridden localDb', async () => {
    const fakeLocalDb = {
      listServers: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    };

    context = await createAppContext(
      { dbPath: ':memory:' },
      {
        repositories: { localDb: fakeLocalDb },
      },
    );

    await destroyAppContext(context);

    expect(fakeLocalDb.close).toHaveBeenCalled();
  });
});