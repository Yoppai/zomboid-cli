/**
 * Phase 2 Task 2.3 — tests/helpers/render-cli.tsx
 *
 * Shared Ink render helper with service override injection.
 *
 * Wraps ink-testing-library's render() with:
 * - Optional service override injection via ServiceProvider
 * - IS_REACT_ACT_ENVIRONMENT guard (no-op in CI without raw mode)
 * - Automatic cleanup on unmount
 * - lastFrame() convenience accessor
 *
 * Usage:
 *   const { instance, cleanup } = renderCli(<MyScreen />, { services: mockSvcs });
 *   expect(instance.lastFrame()).toContain('Expected Text');
 *   cleanup();
 */
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { ServiceProvider } from '@/shared/hooks/use-services.tsx';
import type { AppServices } from '@/shared/hooks/use-services.tsx';

export interface RenderCliOptions {
  /**
   * Optional service overrides. When provided, these are merged with
   * default mock services and passed to ServiceProvider.
   * Pass real service instances here for integration tests.
   */
  // Use loose object type to allow MockServices['services'] (with vi.fn() bags)
  // which is not structurally compatible with strict Partial<AppServices>.
  services?: Record<string, unknown>;
}

/**
 * renderCli — render a React element with optional service overrides.
 *
 * Returns the ink-testing-library instance plus a cleanup() function.
 * The cleanup function calls unmount() and the global cleanup().
 */
export function renderCli(
  node: React.ReactElement,
  options: RenderCliOptions = {},
): {
  instance: ReturnType<typeof render>;
  cleanup: () => void;
} {
  // Detect whether we have a TTY stdin (raw mode support)
  // If not in raw mode, useInput hooks won't fire keypresses, but rendering still works.
  const isRawModeAvailable = process.stdin.isTTY === true;

  // Wrap in ServiceProvider if services are provided
  const wrappedNode = options.services
    ? React.createElement(
        ServiceProvider,
        { services: options.services as unknown as AppServices },
        node,
      )
    : node;

  const instance = render(wrappedNode);

  function cleanupWithUnmount(): void {
    try {
      instance.unmount();
    } catch {
      // ignore if already unmounted
    }
    try {
      cleanup();
    } catch {
      // ignore cleanup errors
    }
  }

  return {
    instance,
    cleanup: cleanupWithUnmount,
  };
}
