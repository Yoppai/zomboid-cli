/**
 * Phase 3 Task 3.1 — tests/index.boot.test.ts
 *
 * RED: bootApp() does not exist yet.
 * This test describes the expected boot seam API from src/index.tsx.
 */
import { expect, test, describe, vi, beforeEach, afterEach } from 'bun:test';
import React from 'react';
import { flushUpdates } from './setup.ts';

// Import bootApp — will fail if boot-app.tsx doesn't exist yet
import { bootApp } from '@/app/entrypoints/boot-app.tsx';

describe('bootApp', () => {
  let mockRender: ReturnType<typeof vi.fn>;
  let mockClear: ReturnType<typeof vi.fn>;
  let mockWaitUntilExit: ReturnType<typeof vi.fn>;
  let mockExit: () => never;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClear = vi.fn();
    mockWaitUntilExit = vi.fn().mockResolvedValue(undefined);
    mockExit = vi.fn() as unknown as () => never;
    mockRender = vi.fn().mockReturnValue({
      clear: mockClear,
      waitUntilExit: mockWaitUntilExit,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('bootApp accepts CliBootDeps and returns waitUntilExit promise', () => {
    const deps = {
      renderApp: mockRender,
      onSigint: vi.fn(),
      exit: mockExit,
    } as Parameters<typeof bootApp>[0];

    const result = bootApp(deps);

    expect(result).toHaveProperty('waitUntilExit');
    expect(typeof result.waitUntilExit).toBe('function');
  });

  test('renderApp is called with a React element that creates AppContextProvider tree', () => {
    const deps = {
      renderApp: mockRender,
      onSigint: vi.fn(),
      exit: mockExit,
    } as Parameters<typeof bootApp>[0];

    bootApp(deps);

    expect(mockRender).toHaveBeenCalledTimes(1);
    const calls = mockRender.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const [reactElement] = calls[0]!;
    expect(reactElement).toBeDefined();
    // The reactElement.type should be the App function (not a string)
    expect(typeof reactElement.type).toBe('function');
  });

  test('SIGINT handler calls onSigint with a function that triggers clear + exit', () => {
    const sigintCallback = vi.fn();
    const deps = {
      renderApp: mockRender,
      onSigint: sigintCallback,
      exit: mockExit,
    } as Parameters<typeof bootApp>[0];

    bootApp(deps);

    // onSigint should be called with a function
    expect(sigintCallback).toHaveBeenCalledTimes(1);
    const calls = sigintCallback.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const handler = calls[0]![0];
    expect(typeof handler).toBe('function');

    // When the handler is called, it should clear and exit
    handler();
    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  test('exitOnCtrlC is set to false in render options', () => {
    const deps = {
      renderApp: mockRender,
      onSigint: vi.fn(),
      exit: mockExit,
    } as Parameters<typeof bootApp>[0];

    bootApp(deps);

    const calls = mockRender.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const renderOptions = calls[0]![1];
    expect(renderOptions).toBeDefined();
    expect(renderOptions.exitOnCtrlC).toBe(false);
  });

  test('waitUntilExit returns the render waitUntilExit promise', async () => {
    const deps = {
      renderApp: mockRender,
      onSigint: vi.fn(),
      exit: mockExit,
    } as Parameters<typeof bootApp>[0];

    const { waitUntilExit } = bootApp(deps);

    expect(waitUntilExit).toBe(mockWaitUntilExit);
  });
});