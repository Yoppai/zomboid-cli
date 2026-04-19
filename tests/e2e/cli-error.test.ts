/**
 * Phase 6 Task 6.3 — tests/e2e/cli-error.test.ts
 *
 * GREEN: E2E smoke — CLI error path.
 *
 * When the CLI encounters a startup error (e.g., no TTY), it must:
 * - Exit with code 1
 * - Produce a descriptive error message on stderr
 *
 * These tests verify the error-path contract.
 */
import { expect, test, describe } from 'bun:test';
import { spawnCli } from '../helpers/spawn-cli.ts';

describe('CLI error path', () => {
  test('cli-error: startup without TTY produces error on stderr', async () => {
    const proc = spawnCli([]);

    const exitCode = await proc.waitForExit(15000);

    // Startup failure must produce error on stderr
    expect(proc.stderr.length).toBeGreaterThan(0);
    expect(proc.stderr).toContain('Raw mode is not supported');
  }, 20000);

  test('cli-error: startup failure exits with code 1', async () => {
    const proc = spawnCli([]);

    const exitCode = await proc.waitForExit(15000);

    // Error exits must be 1
    expect(exitCode).toBe(1);
  }, 20000);

  test('cli-error: stderr contains ink reference confirming error source', async () => {
    const proc = spawnCli([]);

    const exitCode = await proc.waitForExit(15000);

    expect(exitCode).toBe(1);
    // Error originates from ink layer
    expect(proc.stderr).toMatch(/ink/i);
  }, 20000);
});

// ── Invalid args — Phase 6 Task 6.3 spec scenario ──
// Scenario: CLI shows error output for invalid args
//   GIVEN the CLI is invoked with unknown arguments
//   WHEN the process terminates
//   THEN stderr contains an error message
//   AND exit code is non-zero
//
// Implementation: src/index.tsx validates args before Ink render.
// Unknown flags trigger console.error + exit(1) before any TUI init.
describe('CLI invalid args', () => {
  test('cli-invalid-args: unknown flag produces error on stderr', async () => {
    const proc = spawnCli(['--unknown-flag']);

    const exitCode = await proc.waitForExit(10000);

    expect(exitCode).not.toBe(0);
    expect(exitCode).toBe(1);
    expect(proc.stderr).toContain('unknown flag');
  }, 15000);

  test('cli-invalid-args: multiple unknown flags lists all in error', async () => {
    const proc = spawnCli(['--foo', '--bar', '--baz']);

    const exitCode = await proc.waitForExit(10000);

    expect(exitCode).toBe(1);
    expect(proc.stderr).toContain('unknown flag');
  }, 15000);

  test('cli-invalid-args: help text is NOT shown for unknown flags', async () => {
    const proc = spawnCli(['--invalid']);

    const exitCode = await proc.waitForExit(10000);

    expect(exitCode).toBe(1);
    // stderr should NOT contain full help text (that's for --help)
    expect(proc.stderr).not.toContain('zomboid-cli - Project Zomboid');
  }, 15000);
});
