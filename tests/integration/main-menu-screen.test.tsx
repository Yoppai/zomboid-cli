import { expect, test, describe, afterEach, vi, beforeEach } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { MainMenu } from '@/presentation/views/MainMenu.tsx';
import { createNavigationStore } from '@/presentation/store/navigation-store.ts';
import { ServiceProvider } from '@/presentation/hooks/use-services.tsx';

describe('Integration: MainMenu Screen Transitions', () => {
  let navStore: ReturnType<typeof createNavigationStore>;
  let inventoryMock: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    navStore = createNavigationStore();
    inventoryMock = {
      listActive: vi.fn().mockResolvedValue([]),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function flush(ms = 30): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  async function pressKey(stdin: { write: (chunk: string) => void }, key: string, ms = 30): Promise<void> {
    stdin.write(key);
    await flush(ms);
  }

  test('pressing Enter on "Create New Server" navigates to setup-wizard', async () => {
    const { stdin, unmount } = render(
      <ServiceProvider services={{ inventory: inventoryMock as any } as any}>
        <MainMenu navigationStore={navStore} />
      </ServiceProvider>,
    );

    try {
      // Initial selection: index 0 = "Create New Server"
      expect(navStore.getState().current.screen).not.toBe('setup-wizard');

      // Press Enter
      await pressKey(stdin, '\r');

      // Should navigate to setup-wizard
      expect(navStore.getState().current.screen).toBe('setup-wizard');
    } finally {
      unmount();
    }
  });

  test('navigating down then Enter on "Active Servers" fetches servers', async () => {
    const { stdin, unmount } = render(
      <ServiceProvider services={{ inventory: inventoryMock as any } as any}>
        <MainMenu navigationStore={navStore} />
      </ServiceProvider>,
    );

    try {
      // Move to "Active Servers" (index 1)
      await pressKey(stdin, '\x1B[B'); // ArrowDown
      await flush(20);

      // Press Enter
      await pressKey(stdin, '\r');

      // Wait for async listActive to be called
      await flush(50);

      // listActive should have been called (MainMenu fetches server list)
      expect(inventoryMock.listActive).toHaveBeenCalled();
    } finally {
      unmount();
    }
  });

  test('navigating to "Archived Servers" then Enter navigates to archived-servers screen', async () => {
    const { stdin, unmount } = render(
      <ServiceProvider services={{ inventory: inventoryMock as any } as any}>
        <MainMenu navigationStore={navStore} />
      </ServiceProvider>,
    );

    try {
      // Move to "Archived Servers" (index 2)
      await pressKey(stdin, '\x1B[B'); // down
      await pressKey(stdin, '\x1B[B'); // down
      await flush(20);

      // Press Enter
      await pressKey(stdin, '\r');

      expect(navStore.getState().current.screen).toBe('archived-servers');
    } finally {
      unmount();
    }
  });

  test('navigating to "Global Settings" then Enter navigates to settings screen', async () => {
    const { stdin, unmount } = render(
      <ServiceProvider services={{ inventory: inventoryMock as any } as any}>
        <MainMenu navigationStore={navStore} />
      </ServiceProvider>,
    );

    try {
      // Move to "Global Settings" (index 3)
      await pressKey(stdin, '\x1B[B'); // down
      await pressKey(stdin, '\x1B[B'); // down
      await pressKey(stdin, '\x1B[B'); // down
      await flush(20);

      // Press Enter
      await pressKey(stdin, '\r');

      expect(navStore.getState().current.screen).toBe('settings');
    } finally {
      unmount();
    }
  });

  test('Escape does not crash when already on root screen', async () => {
    const { stdin, unmount } = render(
      <ServiceProvider services={{ inventory: inventoryMock as any } as any}>
        <MainMenu navigationStore={navStore} />
      </ServiceProvider>,
    );

    try {
      // Press Escape while on root screen
      await pressKey(stdin, '\x1B');

      // Should remain on root (no crash, no navigation)
      expect(navStore.getState().current.screen).toBe('main-menu');
    } finally {
      unmount();
    }
  });

  test('renders all 4 menu items in initial frame', () => {
    const { lastFrame, unmount } = render(
      <ServiceProvider services={{ inventory: inventoryMock as any } as any}>
        <MainMenu navigationStore={navStore} />
      </ServiceProvider>,
    );

    try {
      expect(lastFrame()).toContain('Create New Server');
      expect(lastFrame()).toContain('Active Servers');
      expect(lastFrame()).toContain('Archived Servers');
      expect(lastFrame()).toContain('Global Settings');
    } finally {
      unmount();
    }
  });

  // ── Escape — non-root scenario ──
  // Scenario: MainMenu is not on the root screen
  //   GIVEN MainMenu is showing the servers sub-view (view='servers')
  //   WHEN user presses Escape
  //   THEN navigation pops to previous screen (returns to 'menu' view)
  //
  // Implementation: MainMenu uses local React state for view management.
  // 'view' starts as 'menu' and switches to 'servers' when user selects
  // "Active Servers". Escape is handled by the inner SelectList on the
  // servers sub-view, which calls setView('menu') via handleServerSelect('back').
  //
  // NOTE: This tests the sub-view Escape path, not the navStore pop path.
  // The navStore.pop() Escape path (when MainMenu is a pushed screen on the
  // navigation stack) is tested separately in the integration suite via
  // screen-level navigation. This test covers the internal view-state Escape.

  test('Escape while on servers sub-view returns to menu', async () => {
    const { stdin, unmount, lastFrame } = render(
      <ServiceProvider services={{ inventory: inventoryMock as any } as any}>
        <MainMenu navigationStore={navStore} />
      </ServiceProvider>,
    );

    try {
      // Navigate to "Active Servers" → sets view='servers'
      await pressKey(stdin, '\x1B[B'); // ArrowDown → index 1
      await flush(20);
      await pressKey(stdin, '\r'); // Enter → handleMenuSelect('active') → setView('servers')
      await flush(50); // wait for useEffect + listActive

      // Confirm we're in the servers sub-view
      expect(navStore.getState().current.screen).toBe('main-menu'); // navStore unchanged
      // The sub-view state is local to MainMenu — Escape is handled by inner SelectList

      // Press Escape on the servers SelectList (back button)
      await pressKey(stdin, '\x1B'); // Escape
      await flush(50); // flush React state + settle

      // Verify the component re-renders with the menu (view='menu')
      expect(lastFrame()).toContain('Create New Server');
      expect(lastFrame()).toContain('Active Servers');
    } finally {
      unmount();
    }
  });
});
