import React from 'react';
import { expect, test, describe, vi, afterEach } from 'bun:test';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { AppContextProvider } from '@/app/providers/AppContextProvider.tsx';
import { useServices } from '@/shared/hooks/use-services.tsx';

// Mock composition root
vi.mock('@/app/composition/composition-root.ts', () => {
  const destroyAppContext = vi.fn().mockResolvedValue(undefined);
  const createAppContext = vi.fn().mockResolvedValue({
    repositories: {},
    services: {
      inventory: { name: 'mockInventory' },
    },
  });
  return { createAppContext, destroyAppContext };
});

import { createAppContext, destroyAppContext } from '@/app/composition/composition-root.ts';

describe('AppContextProvider', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('initializes app context and provides services to children', async () => {
    // A simple component that consumes the service to prove it's provided
    function TestConsumer() {
      const { inventory } = useServices();
      return <Text>{(inventory as any).name}</Text>;
    }

    const { lastFrame } = render(
      <AppContextProvider>
        <TestConsumer />
      </AppContextProvider>
    );

    // Context is created asynchronously. We might see loading state first.
    expect(lastFrame()).toContain('Loading application context...');

    // Wait for the async initialization
    await new Promise((r) => setTimeout(r, 100));

    expect(createAppContext).toHaveBeenCalled();
    expect(lastFrame()).toContain('mockInventory');
  });

  test('cleans up app context on unmount', async () => {
    const { unmount } = render(
      <AppContextProvider>
        <Text>Testing</Text>
      </AppContextProvider>
    );

    // Wait for the async initialization
    await new Promise((r) => setTimeout(r, 20));
    
    // Unmount the provider
    unmount();
    
    // Check if destroyAppContext was called
    expect(destroyAppContext).toHaveBeenCalled();
  });
});
