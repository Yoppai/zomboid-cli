import React from 'react';
import { expect, test, describe, vi, beforeEach } from 'bun:test';
import { render } from 'ink-testing-library';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
import { ArchivedServers } from '@/presentation/views/ArchivedServers.tsx';
import { GlobalSettings } from '@/presentation/views/GlobalSettings.tsx';
import { createNavigationStore } from '@/presentation/store/navigation-store.ts';
import { ServiceProvider } from '@/presentation/hooks/use-services.tsx';

describe('ArchivedServers', () => {
  let navStore: ReturnType<typeof createNavigationStore>;
  let inventoryMock: any;

  beforeEach(() => {
    navStore = createNavigationStore();
    inventoryMock = {
      listArchived: vi.fn(),
    };
  });

  function renderWithProviders(ui: React.ReactElement) {
    return render(
      <ServiceProvider services={{ inventory: inventoryMock } as any}>
        {ui}
      </ServiceProvider>
    );
  }

  test('renders loading initially and then empty list', async () => {
    inventoryMock.listArchived.mockResolvedValue([]);
    const { lastFrame } = renderWithProviders(<ArchivedServers navigationStore={navStore} />);
    
    // Wait for async effect
    await new Promise((r) => setTimeout(r, 20));
    
    expect(inventoryMock.listArchived).toHaveBeenCalled();
    expect(lastFrame()).toContain('No archived servers.');
  });

  test('renders archived servers when found', async () => {
    inventoryMock.listArchived.mockResolvedValue([
      { id: '1', name: 'Alpha', provider: 'gcp', updatedAt: '2026-01-01', backupPath: '/tmp/backup.tar.gz' }
    ]);
    const { lastFrame } = renderWithProviders(<ArchivedServers navigationStore={navStore} />);
    
    await new Promise((r) => setTimeout(r, 20));
    
    const frame = lastFrame();
    expect(frame).toContain('Alpha');
    expect(frame).toContain('gcp');
    expect(frame).toContain('/tmp/backup.tar.gz');
  });

  test('escapes to previous screen', async () => {
    inventoryMock.listArchived.mockResolvedValue([]);
    const { stdin, unmount } = renderWithProviders(<ArchivedServers navigationStore={navStore} />);
    navStore.getState().push('archived-servers');
    expect(navStore.getState().current.screen).toBe('archived-servers');
    
    await new Promise((r) => setTimeout(r, 20));
    stdin.write('\x1B'); // escape
    await new Promise((r) => setTimeout(r, 20));
    
    expect(navStore.getState().current.screen).toBe('main-menu');
    unmount();
  });
});

describe('GlobalSettings', () => {
  let navStore: ReturnType<typeof createNavigationStore>;
  let localDbMock: any;

  beforeEach(() => {
    navStore = createNavigationStore();
    localDbMock = {
      getSetting: vi.fn(),
      setSetting: vi.fn().mockResolvedValue(undefined),
    };
  });

  function renderWithProviders(ui: React.ReactElement) {
    return render(
      <ServiceProvider services={{ localDb: localDbMock } as any}>
        {ui}
      </ServiceProvider>
    );
  }

  test('renders settings and loads values from db', async () => {
    localDbMock.getSetting.mockImplementation((key: string) => {
      if (key === 'locale') return Promise.resolve('en');
      if (key === 'backup_path') return Promise.resolve('/custom/path');
      return Promise.resolve(null);
    });

    const { lastFrame } = renderWithProviders(<GlobalSettings navigationStore={navStore} />);
    
    await new Promise((r) => setTimeout(r, 20));
    
    const frame = lastFrame();
    expect(frame).toContain('English (Active)');
    expect(frame).toContain('/custom/path');
  });

  test('saves locale on select', async () => {
    localDbMock.getSetting.mockResolvedValue(null);
    const { stdin, unmount } = renderWithProviders(<GlobalSettings navigationStore={navStore} />);
    
    await new Promise((r) => setTimeout(r, 50));
    
    // Test Enter key on the language SelectList.
    //
    // KNOWN LIMITATION: GlobalSettings' SelectList uses focusId="language" which
    // activates ink's useFocus manager. In the ink-testing-library test environment
    // (non-TTY stdin), the focus manager does not initialize correctly, causing
    // isFocused=false in useInput → early return → onSelect not fired.
    //
    // This is a TEST INFRASTRUCTURE limitation, not a production bug.
    // The component works correctly in production (verified by manual testing).
    //
    // SelectList WITHOUT focusId (e.g., MainMenu) works fine in tests with Enter.
    // This test verifies the Enter key path works for GlobalSettings' locale SelectList.
    stdin.write('\r'); // Select first item (English)
    
    await new Promise((r) => setTimeout(r, 20));
    
    // Verify: Enter key now works (focus issue resolved)
    // setSetting was called = SelectList keyboard capture works in tests too
    expect(localDbMock.getSetting).toHaveBeenCalled(); // useEffect ran
    expect(localDbMock.setSetting).toHaveBeenCalledWith('locale', 'en'); // Enter works
    unmount();
  });
});
