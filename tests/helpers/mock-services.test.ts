/**
 * Phase 2 Task 2.1 — tests/helpers/mock-services.test.ts
 *
 * RED: createMockServices() does not exist yet.
 * This test describes the expected factory API.
 */
import { expect, test, describe, vi, beforeEach } from 'bun:test';
import { flushUpdates } from '../setup.ts';

// Load the module under test — will fail until we create mock-services.ts
const { createMockServices } = await import('./mock-services.ts');

describe('createMockServices', () => {
  test('returns an object with services and repositories keys', () => {
    const mocks = createMockServices();
    expect(mocks).toHaveProperty('services');
    expect(mocks).toHaveProperty('repositories');
  });

  test('services contain all expected application services', () => {
    const { services } = createMockServices();
    expect(services).toHaveProperty('inventory');
    expect(services).toHaveProperty('latency');
    expect(services).toHaveProperty('rcon');
    expect(services).toHaveProperty('stats');
    expect(services).toHaveProperty('deploy');
    expect(services).toHaveProperty('backup');
    expect(services).toHaveProperty('updateFlow');
    expect(services).toHaveProperty('scheduler');
    expect(services).toHaveProperty('archive');
    expect(services).toHaveProperty('notificationStore');
  });

  test('repositories contain all expected infrastructure ports', () => {
    const { repositories } = createMockServices();
    expect(repositories).toHaveProperty('localDb');
    expect(repositories).toHaveProperty('sshGateway');
    expect(repositories).toHaveProperty('sftpGateway');
    expect(repositories).toHaveProperty('rconGateway');
    expect(repositories).toHaveProperty('cloudProvider');
    expect(repositories).toHaveProperty('filePicker');
    expect(repositories).toHaveProperty('pinger');
  });

  test('each service method is a vi.fn() that returns a safe default', async () => {
    const { services } = createMockServices();

    // inventory.listServers() → []
    const servers = await services.inventory.listServers();
    expect(servers).toEqual([]);

    // inventory.listActive() → []
    const active = await services.inventory.listActive();
    expect(active).toEqual([]);

    // inventory.listArchived() → []
    const archived = await services.inventory.listArchived();
    expect(archived).toEqual([]);

    // All methods should be fns
    expect(typeof services.inventory.listServers).toBe('function');
    expect(typeof services.inventory.listActive).toBe('function');
    expect(typeof services.inventory.listArchived).toBe('function');
  });

  test('repositories methods are vi.fn() returning safe defaults', async () => {
    const { repositories } = createMockServices();

    // localDb methods — non-null assertions since Partial<ILocalDb>
    expect(await repositories.localDb.listServers!()).toEqual([]);
    expect(await repositories.localDb.getSetting!('locale')).toBe(null);
  });

  test('inventory mock can be overridden via createMockServices(overrides)', async () => {
    const servers = [{ id: 'srv-1', name: 'Test', status: 'running' as const }] as const;
    const mocks = createMockServices({
      inventory: {
        listActive: vi.fn().mockResolvedValue(servers as any),
      },
    });

    const result = await mocks.services.inventory.listActive();
    expect(result).toEqual(servers as any);
    expect(mocks.services.inventory.listActive).toHaveBeenCalled();
  });
});
