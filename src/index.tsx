import React from 'react';
import { render } from 'ink';
import { AppShell } from '@/presentation/views/AppShell.tsx';
import { Router } from '@/presentation/views/Router.tsx';
import { AppContextProvider } from '@/presentation/providers/AppContextProvider.tsx';
import { createNavigationStore } from '@/presentation/store/navigation-store.ts';

// Static CLI entrypoints — exit immediately without requiring a TTY
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`zomboid-cli - Project Zomboid server management CLI

Usage:
  zomboid-cli          Start the interactive TUI (requires a terminal)
  zomboid-cli --help   Show this help message
  zomboid-cli --version  Show version information

The TUI requires a terminal with TTY support for keyboard input.
For CI/non-TTY environments, use the TUI's built-in screens directly.`);
  process.exit(0);
}
if (args.includes('--version') || args.includes('-v')) {
  console.log('zomboid-cli 0.1.0');
  process.exit(0);
}

// Validate arguments — reject unknown flags with explicit error
const knownFlags = new Set(['--help', '-h', '--version', '-v']);
const unknownFlags = args.filter(arg => arg.startsWith('-') && !knownFlags.has(arg));
if (unknownFlags.length > 0) {
  console.error(`error: unknown flag(s): ${unknownFlags.join(', ')}`);
  console.error(`Run 'zomboid-cli --help' for usage information.`);
  process.exit(1);
}

const navigationStore = createNavigationStore();

function App() {
  return (
    <AppContextProvider>
      <AppShell>
        <Router navigationStore={navigationStore} />
      </AppShell>
    </AppContextProvider>
  );
}

let renderResult: { clear(): void; waitUntilExit: () => Promise<unknown> };
try {
  renderResult = render(<App />);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

// Handle clean exit on SIGINT
process.on('SIGINT', () => {
  renderResult.clear();
  process.exit(0);
});

renderResult.waitUntilExit().catch((err) => {
  console.error(err);
  process.exit(1);
});
