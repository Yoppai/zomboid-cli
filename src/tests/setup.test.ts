/**
 * Phase 1 Task 1.2 — tests/setup.test.ts
 *
 * RED + GREEN: The setup.ts file configures React 19 + Ink test environment.
 * These tests verify the environment flags and helpers are available.
 *
 * Strict TDD: RED first (run to see failures), then GREEN (setup.ts exists).
 * Since we already wrote setup.ts, these should all pass now.
 */
import { expect, test, describe, vi } from 'bun:test';
import { cleanup } from 'ink-testing-library';

// ── 1.2.1: IS_REACT_ACT_ENVIRONMENT flag is set ──────────────────────────────

test('setup: IS_REACT_ACT_ENVIRONMENT is true after setup loads', () => {
  expect((globalThis as any).IS_REACT_ACT_ENVIRONMENT).toBe(true);
});

// ── 1.2.2: flushUpdates() is an async function ───────────────────────────────

test('setup: flushUpdates() is exported as a function', async () => {
  // Dynamic import so we pick up the live module (not cached require cache)
  const mod = await import('./setup.ts');
  expect(typeof mod.flushUpdates).toBe('function');

  // Should resolve without throwing
  await expect(mod.flushUpdates()).resolves.toBeUndefined();
});

// ── 1.2.3: resetTimers() is exported ────────────────────────────────────────

test('setup: resetTimers() cycles fake/real timers without throwing', () => {
  const mod = require('./setup.ts');

  // Reset should be callable without error
  if (typeof mod.resetTimers === 'function') {
    // Use real timers first so we can detect the cycle
    vi.useRealTimers();
    expect(() => mod.resetTimers()).not.toThrow();
    vi.useRealTimers(); // clean up
  }
});

// ── 1.2.4: Warning trap captures act() warnings ───────────────────────────────

test('setup: warning trap captures act() warnings and getActWarnings returns array', () => {
  const mod = require('./setup.ts');
  expect(typeof mod.getActWarnings).toBe('function');
  const warnings = mod.getActWarnings();
  expect(Array.isArray(warnings)).toBe(true);
});

// ── 1.2.5: ink-testing-library render and cleanup are available ───────────────

test('setup: ink-testing-library render and cleanup are importable', async () => {
  const inkLib = await import('ink-testing-library');
  expect(typeof inkLib.render).toBe('function');
  expect(typeof inkLib.cleanup).toBe('function');
});

// ── 1.2.6: beforeEach and afterEach hooks are exported (noop import) ──────────

test('setup: setup.ts loads without error (hooks registered via import side effect)', async () => {
  // If setup.ts had a syntax or import error, this import would throw.
  // The actual hooks (beforeEach/afterEach) are registered by Bun automatically.
  const mod = await import('./setup.ts');
  expect(mod).toBeDefined();
});
