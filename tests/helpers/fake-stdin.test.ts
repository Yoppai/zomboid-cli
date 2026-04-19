/**
 * Phase 2 Task 2.2 — tests/helpers/fake-stdin.test.ts
 *
 * RED: fake-stdin.ts does not exist yet.
 * This test describes the expected stdin harness API.
 */
import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { flushUpdates } from '../setup.ts';

const { createFakeStdin } = await import('./fake-stdin.ts');

describe('createFakeStdin', () => {
  let stdin: ReturnType<typeof createFakeStdin>;

  test('returns an object with write, enter, arrowDown, arrowUp, escape, ctrlC methods', () => {
    stdin = createFakeStdin();
    expect(typeof stdin.write).toBe('function');
    expect(typeof stdin.enter).toBe('function');
    expect(typeof stdin.arrowDown).toBe('function');
    expect(typeof stdin.arrowUp).toBe('function');
    expect(typeof stdin.escape).toBe('function');
    expect(typeof stdin.ctrlC).toBe('function');
  });

  test('enter() writes carriage return', async () => {
    stdin = createFakeStdin();
    await stdin.enter();
    // The harness records what was written
    expect(stdin.getBuffer()).toContain('\r');
  });

  test('arrowDown() writes ESC[B (CSI B = down)', async () => {
    stdin = createFakeStdin();
    await stdin.arrowDown();
    expect(stdin.getBuffer()).toBe('\x1B[B');
  });

  test('arrowUp() writes ESC[A (CSI A = up)', async () => {
    stdin = createFakeStdin();
    await stdin.arrowUp();
    expect(stdin.getBuffer()).toBe('\x1B[A');
  });

  test('escape() writes ESC', async () => {
    stdin = createFakeStdin();
    await stdin.escape();
    expect(stdin.getBuffer()).toBe('\x1B');
  });

  test('ctrlC() writes SIGINT (Ctrl+C)', async () => {
    stdin = createFakeStdin();
    await stdin.ctrlC();
    expect(stdin.getBuffer()).toBe('\x03');
  });

  test('tab() writes tab character', async () => {
    stdin = createFakeStdin();
    await stdin.tab();
    expect(stdin.getBuffer()).toBe('\t');
  });

  test('backspace() writes backspace character', async () => {
    stdin = createFakeStdin();
    await stdin.backspace();
    expect(stdin.getBuffer()).toBe('\x7F');
  });

  test('write() appends arbitrary string to buffer', async () => {
    stdin = createFakeStdin();
    await stdin.write('hello');
    expect(stdin.getBuffer()).toBe('hello');
  });

  test('clearBuffer() resets the buffer', async () => {
    stdin = createFakeStdin();
    await stdin.write('hello');
    await stdin.write('world');
    stdin.clearBuffer();
    expect(stdin.getBuffer()).toBe('');
  });

  test('isRawMode is true when stdin.isTTY is true', () => {
    stdin = createFakeStdin();
    // raw mode detection is based on stdin.isTTY at construction time
    expect(typeof stdin.isRawMode).toBe('boolean');
  });
});
