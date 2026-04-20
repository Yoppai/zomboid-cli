import React, { useEffect, useState } from 'react';
import { Text } from 'ink';
import { createAppContext, destroyAppContext } from '@/composition-root.ts';
import { ServiceProvider } from '@/presentation/hooks/use-services.tsx';
import { hydrateRuntimeLocale } from '@/presentation/hooks/use-translation.ts';
import { createNotificationStore } from '@/presentation/store/notification-store.ts';

export interface AppContextProviderProps {
  readonly children: React.ReactNode;
  /**
   * Optional factory for deterministic testing.
   * When provided, AppContextProvider uses this instead of calling createAppContext().
   * Useful for integration tests that need controlled context with fake services/repositories.
   */
  readonly contextFactory?: () => Promise<any>;
}

export function AppContextProvider({ children, contextFactory }: AppContextProviderProps) {
  const [context, setContext] = useState<any>(null);
  const [notificationStore] = useState(() => createNotificationStore());

  useEffect(() => {

    let active = true;
    let appCtx: any = null;

    const createContext = contextFactory ?? createAppContext;

    createContext().then(ctx => {
      if (active) {
        appCtx = ctx;

        // Hydrate runtime locale from persisted setting (default remains 'en').
        const localDb = ctx?.repositories?.localDb;
        if (localDb && typeof localDb.getSetting === 'function') {
          localDb
            .getSetting('locale')
            .then((locale: string | null) => hydrateRuntimeLocale(locale))
            .catch(console.error);
        }

        setContext(ctx);
      } else {
        // If unmounted before creation finished, clean up immediately
        destroyAppContext(ctx).catch(console.error);
      }
    }).catch(console.error);

    return () => {
      active = false;
      if (appCtx) {
        destroyAppContext(appCtx).catch(console.error);
      }
    };
  }, []);

  if (!context) {
    return <Text>Loading application context...</Text>;
  }

  const combinedServices = {
    ...context.services,
    notificationStore,
    sshGateway: context.repositories.sshGateway,
    cloudProvider: context.repositories.cloudProvider,
    localDb: context.repositories.localDb,
    filePickerGateway: context.repositories.filePicker,
  };


  return (
    <ServiceProvider services={combinedServices}>
      {children}
    </ServiceProvider>
  );
}
