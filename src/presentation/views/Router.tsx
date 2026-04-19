import React, { useMemo, useSyncExternalStore } from 'react';
import { Text } from 'ink';
import type { NavigationStore, ScreenEntry } from '@/presentation/store/navigation-store.ts';
import { createWizardStore } from '@/presentation/store/wizard-store.ts';
import { MainMenu } from '@/presentation/views/MainMenu.tsx';
import { SetupWizard } from '@/presentation/views/SetupWizard.tsx';
import { ServerDashboard } from '@/presentation/views/ServerDashboard.tsx';
import { ArchivedServers } from '@/presentation/views/ArchivedServers.tsx';
import { GlobalSettings } from '@/presentation/views/GlobalSettings.tsx';

// ── Props ──

export interface RouterProps {
  readonly navigationStore: NavigationStore;
}

// ── Component ──

export function Router({ navigationStore }: RouterProps) {
  const wizardStore = useMemo(() => createWizardStore(), []);
  const currentScreen = useSyncExternalStore<ScreenEntry>(
    (onStoreChange) => navigationStore.subscribe(onStoreChange),
    () => navigationStore.getState().current,
  );

  return renderScreen(currentScreen, navigationStore, wizardStore);
}

// ── Screen renderer ──

function renderScreen(
  entry: ScreenEntry,
  navigationStore: NavigationStore,
  wizardStore: ReturnType<typeof createWizardStore>,
): React.ReactElement {
  switch (entry.screen) {
    case 'main-menu':
      return <MainMenu navigationStore={navigationStore} />;
    case 'setup-wizard':
      return <SetupWizard navigationStore={navigationStore} wizardStore={wizardStore} />;
    case 'server-dashboard':
      return <ServerDashboard serverId={String(entry.params?.serverId ?? '')} navigationStore={navigationStore} />;
    case 'archived-servers':
      return <ArchivedServers navigationStore={navigationStore} />;
    case 'settings':
      return <GlobalSettings navigationStore={navigationStore} />;
    default:
      return <Text>[unknown]</Text>;
  }
}
