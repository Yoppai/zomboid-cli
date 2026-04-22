/**
 * Phase 3 Task 3.1 — src/boot-app.ts
 *
 * Boot seam that extracts app startup from src/index.tsx.
 *
 * Allows tests to inject render, signal handler, and exit dependencies
 * so stdin/raw-mode/exit behavior can be tested deterministically.
 *
 * Usage:
 *   const { waitUntilExit } = bootApp({
 *     renderApp: (el, opts) => render(el, { ...opts }),
 *     onSigint: (handler) => process.on('SIGINT', handler),
 *     exit: (code) => process.exit(code),
 *   });
 *
 * In production, pass the real render, process.on, and process.exit.
 * In tests, pass mocks or fakes.
 */
import React from 'react';
import { AppShell } from '@/shared/components/shell/AppShell.tsx';
import { Router } from '@/app/routing/Router.tsx';
import { AppContextProvider } from '@/app/providers/AppContextProvider.tsx';

export interface CliBootDeps {
  /**
   * The render function (e.g., ink's `render`).
   * Called with: renderApp(element, { exitOnCtrlC: false, isRawModeSupported: ... })
   */
  renderApp: (
    element: React.ReactElement,
    options?: { exitOnCtrlC?: boolean; isRawModeSupported?: boolean },
  ) => { clear: () => void; waitUntilExit: () => Promise<void> };
  /**
   * Register a SIGINT handler. Pass the handler that will be invoked on Ctrl+C.
   */
  onSigint: (handler: () => void) => void;
  /**
   * Exit the process with a code. Called after clear() on SIGINT.
   */
  exit: (code: number) => never;
}

/**
 * bootApp — boot the CLI application with injectable dependencies.
 *
 * Returns waitUntilExit promise from the render lifecycle so callers
 * can await clean shutdown.
 */
export function bootApp(deps: CliBootDeps): { waitUntilExit: () => Promise<void> } {
  function App() {
    return (
      <AppContextProvider>
        <AppShell>
          <Router />
        </AppShell>
      </AppContextProvider>
    );
  }

  const { waitUntilExit, clear } = deps.renderApp(<App />, { exitOnCtrlC: false });

  deps.onSigint(() => {
    clear();
    deps.exit(0);
  });

  return { waitUntilExit };
}
