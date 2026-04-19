/**
 * Phase 2 Task 2.5 — tests/helpers/spawn-cli.ts
 *
 * Subprocess harness for E2E smoke tests.
 *
 * Spawns `bun run src/index.tsx` (or custom argv) as a child process, captures
 * stdout/stderr, and provides signal control (kill, Ctrl+C injection).
 *
 * Usage:
 *   const proc = spawnCli(['--help']);
 *   const exitCode = await proc.waitForExit();
 *   expect(proc.stdout).toContain('--help');
 *
 *   // Or with stdin:
 *   const proc2 = spawnCli([]);
 *   await proc2.write('my input');
 *   proc2.kill();
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

export interface SpawnCliResult {
  /** Wait for the process to exit and return the exit code */
  waitForExit(timeoutMs?: number): Promise<number>;
  /** Send signal to the process (defaults to killSignal from options, or SIGTERM) */
  kill(signal?: string): void;
  /** Write a string to stdin (if process is still running) */
  write(text: string): void;
  /** Write a control sequence (e.g. ctrlC writes \x03) */
  writeCtrl(ctrlChar: string): void;
  /** Accumulated stdout output */
  readonly stdout: string;
  /** Accumulated stderr output */
  readonly stderr: string;
  /** Resolved exit code after process exits (or null if still running) */
  readonly exitCode: number | null;
}

export interface SpawnCliOptions {
  /** Working directory for the child process. Defaults to project root. */
  cwd?: string;
  /** Environment variables. Defaults to process.env. */
  env?: Record<string, string>;
  /**
   * Signal to send on kill(). Defaults to 'SIGTERM'.
   * Pass 'SIGKILL' for forceful termination.
   */
  killSignal?: string;
}

/**
 * isRawModeSupported — returns true when stdin.isTTY is true.
 *
 * In CI/piped environments, process.stdin is not a TTY, so raw-mode
 * keyboard injection is not possible. The harness still works (can spawn,
 * capture output, kill) but stdin.write() is a no-op.
 */
export function isRawModeSupported(): boolean {
  return process.stdin.isTTY === true;
}

function resolveEntryPoint(): string {
  // Use 'bun run src/index.tsx' — works in both dev and built scenarios
  return 'bun';
}

function resolveArgs(): string[] {
  return ['run', 'src/index.tsx'];
}

/**
 * spawnCli — spawn the CLI as a subprocess for E2E testing.
 *
 * @param extraArgs  Additional CLI arguments (e.g. ['--help', '--verbose'])
 * @param options    Spawn options (cwd, env, killSignal)
 */
export function spawnCli(
  extraArgs: string[] = [],
  options: SpawnCliOptions = {},
): SpawnCliResult {
  const {
    cwd = process.cwd(),
    env = { ...process.env },
    killSignal = 'SIGTERM',
  } = options;

  const entryPoint = resolveEntryPoint();
  const defaultArgs = resolveArgs();
  const args = [...defaultArgs, ...extraArgs];

  let proc: ChildProcess;
  let exitCode: number | null = null;
  let hasExited = false;

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  // Capture raw mode support at construction time
  const rawModeAvailable = isRawModeSupported();

  // Spawn the child process
  proc = spawn(entryPoint, args, {
    cwd,
    env,
    stdio: rawModeAvailable ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  proc.stdout?.on('data', (chunk: Buffer) => {
    stdoutChunks.push(chunk.toString());
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    stderrChunks.push(chunk.toString());
  });

  proc.on('close', (code: number | null) => {
    exitCode = code;
    hasExited = true;
  });

  proc.on('error', (err: Error) => {
    stderrChunks.push(`SPAWN_ERROR: ${err.message}`);
    hasExited = true;
  });

  function kill(signal?: string): void {
    if (!proc.killed && proc.pid) {
      try {
        process.kill(proc.pid, signal ?? killSignal);
      } catch {
        // PID may have already exited
      }
    }
  }

  function write(text: string): void {
    if (proc.stdin && !proc.stdin.writableEnded) {
      proc.stdin.write(text);
    }
  }

  function writeCtrl(ctrlChar: string): void {
    write(ctrlChar);
  }

  async function waitForExit(timeoutMs = 10000): Promise<number> {
    if (hasExited) return exitCode ?? 0;

    return new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Force kill on timeout
        if (!hasExited) {
          try {
            process.kill(proc.pid!, 'SIGKILL');
          } catch {
            // ignore
          }
        }
        reject(new Error(`spawn-cli: process did not exit within ${timeoutMs}ms`));
      }, timeoutMs);

      proc.once('close', (code: number | null) => {
        clearTimeout(timer);
        resolve(code ?? 0);
      });
    });
  }

  return {
    waitForExit,
    kill,
    write,
    writeCtrl,
    get stdout() {
      return stdoutChunks.join('');
    },
    get stderr() {
      return stderrChunks.join('');
    },
    get exitCode() {
      return exitCode;
    },
  };
}
