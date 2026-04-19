/**
 * Phase 6 Task 6.4 — tests/e2e/cli-help.test.ts
 *
 * GREEN: E2E smoke — CLI help/version entrypoints.
 *
 * Static CLI entrypoints that work without a TTY:
 * - --help / -h: print usage and exit 0
 * - --version / -v: print version and exit 0
 *
 * These are implemented as early-exit checks in src/index.tsx before
 * any Ink rendering occurs.
 */
import { expect, test, describe } from 'bun:test';
import { spawnCli } from '../helpers/spawn-cli.ts';

describe('CLI help entrypoint', () => {
  test('cli-help: --help exits 0 and prints usage to stdout', async () => {
    const proc = spawnCli(['--help']);

    const exitCode = await proc.waitForExit(10000);

    expect(exitCode).toBe(0);
    expect(proc.stdout).toContain('Usage:');
    expect(proc.stdout).toContain('zomboid-cli');
  }, 15000);

  test('cli-help: -h (short alias) exits 0', async () => {
    const proc = spawnCli(['-h']);

    const exitCode = await proc.waitForExit(10000);

    expect(exitCode).toBe(0);
    expect(proc.stdout).toContain('Usage:');
  }, 15000);

  test('cli-help: --version exits 0 and prints version', async () => {
    const proc = spawnCli(['--version']);

    const exitCode = await proc.waitForExit(10000);

    expect(exitCode).toBe(0);
    expect(proc.stdout).toContain('0.1.0');
  }, 15000);

  test('cli-help: -v (short alias) exits 0', async () => {
    const proc = spawnCli(['-v']);

    const exitCode = await proc.waitForExit(10000);

    expect(exitCode).toBe(0);
    expect(proc.stdout).toContain('0.1.0');
  }, 15000);

  test('cli-help: --help does NOT print to stderr', async () => {
    const proc = spawnCli(['--help']);

    const exitCode = await proc.waitForExit(10000);

    expect(exitCode).toBe(0);
    // Help output goes to stdout, not stderr
    expect(proc.stderr).toHaveLength(0);
  }, 15000);
});
