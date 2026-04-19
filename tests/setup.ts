/**
 * tests/setup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Global test runtime configuration for Bun + React 19 + Ink.
 *
 * This project uses Ink 7, which renders via `react-reconciler` directly.
 * There is NO `react-dom`, hence NO `act()` from `react-dom`.
 * React 19 removed the standalone `act()` API.
 *
 * Instead we:
 * 1. Set IS_REACT_ACT_ENVIRONMENT so the reconciler knows this is a test env
 * 2. Provide flushUpdates() using async ticks + cleanup
 * 3. Trap console.error warnings from the reconciler
 * 4. Reset timers between tests
 *
 * Loaded via bunfig.toml: `bun test --preload ./tests/setup.ts`
 *
 * Phase 1 — cli-testing-foundation-v1
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { beforeEach, afterEach } from 'bun:test';
import { cleanup } from 'ink-testing-library';

// ── 1. Tell the reconciler this is an act()-aware test environment ──────────────
// React 19 + react-reconciler checks this flag before emitting "not wrapped
// in act(...)" warnings. Without it, every useInput-triggered setState causes
// a warning in the test output.
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// ── 2. Warning trap for reconciler warnings ────────────────────────────────────
const actWarnings: string[] = [];

// We only patch console.error during normal test runs (not --update snapshots).
const IS_TEST_RUN = !process.argv.includes('--update');

// Sentinel: if set, the current console.error call is from within this trap
// and should not be reported by downstream console.error wrappers.
const ACT_WARNING_SENTINEL = '__act_warning__';

if (IS_TEST_RUN) {
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? '');
    if (
      msg.includes('not wrapped in act') ||
      msg.includes('An update to') ||
      msg.includes('current testing environment is not configured to support act')
    ) {
      actWarnings.push(msg);
      // Suppress the warning entirely — do NOT even call originalError,
      // because doing so would propagate to any console.error spy that
      // wrapped console.error AFTER this trap was installed.
      return;
    }
    originalError(...args);
  };
}

// ── 3. Shared helpers ────────────────────────────────────────────────────────

/**
 * flushUpdates — flush pending React state updates after async work.
 *
 * After tests simulate keyboard input, timers, or async effects, React's
 * reconciler may still have pending work. Use this to wait for the tree
 * to settle before asserting on lastFrame().
 *
 * @example
 *   stdin.write('\r');
 *   await flushUpdates();
 *   expect(lastFrame()).toContain('Next Screen');
 */
export async function flushUpdates(): Promise<void> {
  // React 19 automatically batches. Give the micro-task queue one full
  // tick to drain, then give the reconciler a chance to commit.
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  await Promise.resolve();
}

/**
 * resetTimers — reset fake timers to a clean clock.
 * Called automatically by the global beforeEach. Exported for ad-hoc use.
 */
export function resetTimers(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { vi } = globalThis as any;
  if (vi?.useRealTimers) {
    vi.useRealTimers();
    vi.useFakeTimers();
  }
}

/**
 * getActWarnings — returns warnings captured by the trap since last flush.
 * Call after a test's last assertion to verify no act() noise occurred.
 */
export function getActWarnings(): string[] {
  return [...actWarnings];
}

// ── 4. Global beforeEach: always start each test with a clean clock ───────────
beforeEach(() => {
  resetTimers();
});

// ── 5. Global afterEach: flush pending updates and cleanup ────────────────────
afterEach(async () => {
  // Flush any pending reconciler work before the next test starts.
  // This catches state updates that were triggered but not yet committed.
  try {
    await flushUpdates();
  } catch {
    // Ignore — broken state in one test should not cascade to the next.
  }

  // ink-testing-library tracks all rendered instances so we can clean them up.
  try {
    cleanup();
  } catch {
    // Cleanup may fail if render is already unmounted; ignore.
  }

  // Clear warnings captured in this test so the next test starts clean.
  actWarnings.length = 0;
});
