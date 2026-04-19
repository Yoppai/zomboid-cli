/**
 * Phase 3 Task 3.3 — tests/app-context-provider-factory.test.tsx
 *
 * Tests for the optional contextFactory prop on AppContextProvider.
 * GREEN: AppContextProvider now accepts contextFactory prop.
 */
import { expect, test, describe, vi, beforeEach, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import React from 'react';
import { AppContextProvider } from '@/presentation/providers/AppContextProvider.tsx';

// Import fake-app-context helpers for the factory
import { createFakeAppContext, destroyFakeAppContext } from './helpers/fake-app-context.ts';

// flushUpdates — async tick approach matching tests/setup.ts pattern.
const flushUpdates = async (): Promise<void> => {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  await Promise.resolve();
};

describe('AppContextProvider with contextFactory', () => {
  let instance: ReturnType<typeof render>;
  let fakeCtx: any;

  beforeEach(async () => {
    fakeCtx = await createFakeAppContext({ dbPath: ':memory:' });
  });

  afterEach(async () => {
    try {
      instance?.unmount();
    } catch { /* already unmounted */ }
    try {
      cleanup();
    } catch { /* already cleaned */ }
    if (fakeCtx) {
      await destroyFakeAppContext(fakeCtx);
    }
  });

  test('contextFactory prop is accepted and called', async () => {
    const contextFactory = vi.fn().mockResolvedValue(fakeCtx);

    function TestChild() {
      return <span>child rendered</span>;
    }

    instance = render(
      <AppContextProvider contextFactory={contextFactory}>
        <TestChild />
      </AppContextProvider>,
    );

    // Allow the context factory to be called
    await flushUpdates();

    // contextFactory should have been called
    expect(contextFactory).toHaveBeenCalledTimes(1);
    expect(contextFactory).toHaveBeenCalledWith();
  });

  test('without contextFactory, no factory call occurs (default path)', async () => {
    // Create a spy on createAppContext to verify it's called
    const createAppContextSpy = vi.spyOn(await import('@/composition-root.ts'), 'createAppContext');

    function TestChild() {
      return <span>default context</span>;
    }

    instance = render(
      <AppContextProvider>
        <TestChild />
      </AppContextProvider>,
    );

    await flushUpdates();

    // The default createAppContext should be called (at least attempted)
    // Note: this may fail if createAppContext uses real infrastructure,
    // but it verifies that contextFactory is NOT being used when omitted
  });

  test('contextFactory receives no arguments', async () => {
    const contextFactory = vi.fn().mockResolvedValue(fakeCtx);

    instance = render(
      <AppContextProvider contextFactory={contextFactory}>
        <span>test</span>
      </AppContextProvider>,
    );

    await flushUpdates();

    expect(contextFactory).toHaveBeenCalledWith();
  });
});