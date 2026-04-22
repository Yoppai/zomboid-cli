/**
 * Phase 2 Task 2.5 — tests/helpers/spawn-cli.test.ts
 *
 * RED: spawn-cli.ts does not exist yet.
 * This test describes the expected spawnCli() harness API.
 *
 * NOTE: The actual CLI (src/index.tsx) requires a TTY for Ink to render.
 * When stdin is not a TTY (CI), Ink throws "Raw mode is not supported".
 * These tests verify the harness API works correctly regardless of whether
 * the target process succeeds or fails — we test the harness interface,
 * not the CLI's behavior.
 */
import { expect, test, describe } from 'bun:test';
import { spawnCli, isRawModeSupported } from './spawn-cli.ts';

describe('spawnCli', () => {
  test('returns an object with waitForExit, kill, write, writeCtrl, stdout, stderr, exitCode', async () => {
    const proc = spawnCli([]);

    expect(proc).toHaveProperty('waitForExit');
    expect(proc).toHaveProperty('kill');
    expect(proc).toHaveProperty('write');
    expect(proc).toHaveProperty('writeCtrl');
    expect(proc).toHaveProperty('stdout');
    expect(proc).toHaveProperty('stderr');
    expect(proc.exitCode).toBeNull(); // not exited yet

    proc.kill();
  });

  test('waitForExit() resolves with an exit code after the process exits', async () => {
    // Spawn with extra args that will cause Ink to fail gracefully in non-TTY
    // (this tests the harness waitForExit, not CLI correctness)
    const proc = spawnCli([]);

    const exitCode = await proc.waitForExit(15000);

    // Process should have exited (either cleanly or with an error)
    expect(exitCode).not.toBeNull();
    expect(typeof exitCode).toBe('number');

    proc.kill(); // no-op if already exited
  }, 20000);

  test('kill() terminates a running process', async () => {
    const proc = spawnCli([]);

    // Give it a moment to start
    await new Promise(r => setTimeout(r, 100));

    proc.kill();

    // waitForExit should return quickly after kill
    const exitCode = await proc.waitForExit(5000);
    expect(exitCode).not.toBe(0); // killed process is non-zero
  }, 10000);

  test('custom cwd option is accepted without throwing', async () => {
    const proc = spawnCli([], { cwd: process.cwd() });
    const exitCode = await proc.waitForExit(5000);
    // Just verify it didn't throw — process runs with given cwd
    expect(typeof exitCode).toBe('number');
    proc.kill();
  }, 10000);
});

describe('isRawModeSupported', () => {
  test('returns a boolean indicating TTY raw mode availability', () => {
    const supported = isRawModeSupported();
    expect(typeof supported).toBe('boolean');
  });
});
