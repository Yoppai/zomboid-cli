/**
 * Phase 2 Task 2.2 — tests/helpers/fake-stdin.ts
 *
 * Raw-mode-aware stdin writer for testing useInput hooks.
 *
 * When process.stdin.isTTY is true, stdin is writable in raw mode and we can
 * inject keystrokes programmatically. When no TTY is available (CI, piped),
 * the harness tracks what WOULD have been written so tests remain informative.
 *
 * Usage:
 *   const { stdin } = render(<MyComponent />);
 *   const fake = createFakeStdin();
 *   await fake.arrowDown();
 *   await fake.enter();
 *
 * The actual stdin.write() is called only when isRawMode is true.
 */
export interface FakeStdin {
  /** Write an arbitrary string to stdin */
  write(text: string): Promise<void>;
  /** Press Enter (carriage return) */
  enter(): Promise<void>;
  /** Press Arrow Down (ESC[B) */
  arrowDown(): Promise<void>;
  /** Press Arrow Up (ESC[A) */
  arrowUp(): Promise<void>;
  /** Press Escape */
  escape(): Promise<void>;
  /** Send Ctrl+C (SIGINT = 0x03) */
  ctrlC(): Promise<void>;
  /** Press Tab */
  tab(): Promise<void>;
  /** Press Backspace (DEL = 0x7F) */
  backspace(): Promise<void>;
  /** Get the accumulated write buffer (for assertions) */
  getBuffer(): string;
  /** Clear the accumulated write buffer */
  clearBuffer(): void;
  /** Whether raw-mode stdin writing is available (stdin.isTTY) */
  readonly isRawMode: boolean;
}

const ESC = '\x1B';
const CR = '\r';
const LF = '\n';
const TAB = '\t';
const DEL = '\x7F';
const CTRL_C = '\x03';

function isRawModeAvailable(): boolean {
  return process.stdin.isTTY === true;
}

/**
 * createFakeStdin — factory for a fake stdin writer.
 *
 * When raw mode is available, writes go to process.stdin (which is the renderer's
 * stdin in Ink's test harness). When raw mode is NOT available (CI), writes
 * are tracked in an internal buffer so tests can still assert on input intent.
 */
export function createFakeStdin(): FakeStdin {
  const isRawMode = isRawModeAvailable();
  const buffer: string[] = [];

  async function write(text: string): Promise<void> {
    if (isRawMode) {
      process.stdin.write(text);
    }
    buffer.push(text);
  }

  return {
    async write(text: string) {
      await write(text);
    },

    async enter() {
      // CR (\r) is what useInput reads on Enter
      await write(CR);
    },

    async arrowDown() {
      // CSI B: ESC[B
      await write(`${ESC}[B`);
    },

    async arrowUp() {
      // CSI A: ESC[A
      await write(`${ESC}[A`);
    },

    async escape() {
      await write(ESC);
    },

    async ctrlC() {
      await write(CTRL_C);
    },

    async tab() {
      await write(TAB);
    },

    async backspace() {
      await write(DEL);
    },

    getBuffer() {
      return buffer.join('');
    },

    clearBuffer() {
      buffer.length = 0;
    },

    get isRawMode() {
      return isRawMode;
    },
  };
}
