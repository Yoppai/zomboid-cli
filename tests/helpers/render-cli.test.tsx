/**
 * Phase 2 Task 2.3 — tests/helpers/render-cli.test.tsx
 *
 * Verifies the renderCli() test helper wraps ink-testing-library
 * render with the ServiceProvider pattern.
 */
import React from 'react';
import { Text } from 'ink';
import { expect, test, describe, vi } from 'bun:test';
import { flushUpdates } from '../setup.ts';
import { createMockServices } from '@/tests/helpers/mock-services.ts';

const { renderCli } = await import('./render-cli.tsx');

// Simple test component using Ink primitives (Box + Text)
function FakeScreen({ name }: { name: string }) {
  return <Text>Hello {name}</Text>;
}

describe('renderCli', () => {
  test('returns { instance, cleanup } from ink-testing-library render', async () => {
    const mocks = createMockServices();
    const { instance, cleanup } = renderCli(<FakeScreen name="World" />, {
      services: mocks.services,
    });

    expect(instance).toBeDefined();
    expect(typeof cleanup).toBe('function');
    expect(typeof instance.lastFrame).toBe('function');

    await flushUpdates();
    expect(instance.lastFrame()).toContain('Hello World');

    cleanup();
  });

  test('renders with custom services override', async () => {
    const servers = [{ id: 'srv-1', name: 'My Server', status: 'running' as const }];
    const mocks = createMockServices({
      inventory: {
        listActive: vi.fn().mockResolvedValue(servers),
      },
    });

    const { instance, cleanup } = renderCli(<FakeScreen name="Test" />, {
      services: mocks.services,
    });

    await flushUpdates();
    expect(instance.lastFrame()).toContain('Hello Test');

    cleanup();
  });

  test('cleanup() is callable and does not throw', async () => {
    const { cleanup } = renderCli(<FakeScreen name="Cleanup" />, {
      services: createMockServices().services,
    });

    await flushUpdates();
    expect(() => cleanup()).not.toThrow();
  });
});
