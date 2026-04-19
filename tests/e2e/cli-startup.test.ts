/**
 * Phase 6 Task 6.1 — tests/e2e/cli-startup.test.ts
 *
 * GREEN: E2E smoke — CLI startup in non-TTY.
 *
 * The CLI renders an Ink TUI that requires a TTY for raw-mode input.
 * When spawned without a TTY (CI/piped), Ink emits an error on stderr
 * via console.error and exits with code 1. The error message contains
 * "Raw mode is not supported".
 *
 * Happy-path TTY startup is not testable in CI but is validated manually.
 */
import { expect, test, describe } from 'bun:test';
import { spawnCli } from '../helpers/spawn-cli.ts';

describe('CLI startup (non-TTY smoke)', () => {
  test('cli-startup: spawns and exits non-zero in non-TTY with descriptive error on stderr', async () => {
    const proc = spawnCli([]);

    const exitCode = await proc.waitForExit(15000);

    // Non-zero exit — Ink cannot render without TTY raw mode
    expect(exitCode).not.toBe(0);
    expect(exitCode).toBe(1);

    // Stderr must contain the known Ink raw-mode error
    expect(proc.stderr).toContain('Raw mode is not supported');
  }, 20000);

  test('cli-startup: stderr contains ink reference confirming error originated in ink', async () => {
    const proc = spawnCli([]);

    const exitCode = await proc.waitForExit(15000);

    expect(exitCode).toBe(1);
    // Error is thrown by ink's App component
    expect(proc.stderr).toMatch(/ink/i);
  }, 20000);
});
