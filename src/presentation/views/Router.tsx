import React, { useMemo, useSyncExternalStore } from 'react';
import { Text } from 'ink';
import type { NavigationStore, ScreenEntry } from '@/presentation/store/navigation-store.ts';
import { createWizardStore } from '@/presentation/store/wizard-store.ts';
import { MainMenu } from '@/presentation/views/MainMenu.tsx';
import { SetupWizard } from '@/presentation/views/SetupWizard.tsx';
import { ServerDashboard } from '@/presentation/views/ServerDashboard.tsx';
import { ArchivedServers } from '@/presentation/views/ArchivedServers.tsx';
import { GlobalSettings } from '@/presentation/views/GlobalSettings.tsx';
import { DashboardShellScreen } from '@/presentation/views/DashboardShellScreen.tsx';

// Feature flag: set DASHBOARD_SHELL=1 to enable persistent shell mount
const USE_DASHBOARD_SHELL = process.env.DASHBOARD_SHELL === '1';

// ── Props ──

export interface RouterProps {
  readonly navigationStore: NavigationStore;
}

// ── Component ──

export function Router({ navigationStore }: RouterProps) {
  // If dashboard shell is enabled, mount it as the single persistent shell
  if (USE_DASHBOARD_SHELL) {
    return <DashboardShellScreen />;
  }

  // Legacy path — screen-stack routing (rollback path)
  const wizardStore = useMemo(() => createWizardStore(), []);
  return <LegacyRouter navigationStore={navigationStore} wizardStore={wizardStore} />;
}

// ── Legacy screen renderer ──

function LegacyRouter({
  navigationStore,
  wizardStore,
}: {
  navigationStore: NavigationStore;
  wizardStore: ReturnType<typeof createWizardStore>;
}) {
  const currentScreen = useSyncExternalStore<ScreenEntry>(
    (onStoreChange) => navigationStore.subscribe(onStoreChange),
    () => navigationStore.getState().current,
  );

  switch (currentScreen.screen) {
    case 'main-menu':
      return <MainMenu navigationStore={navigationStore} />;
    case 'setup-wizard':
      return <SetupWizard navigationStore={navigationStore} wizardStore={wizardStore} />;
    case 'server-dashboard':
      return <ServerDashboard serverId={String(currentScreen.params?.serverId ?? '')} navigationStore={navigationStore} />;
    case 'archived-servers':
      return <ArchivedServers navigationStore={navigationStore} />;
    case 'settings':
      return <GlobalSettings navigationStore={navigationStore} />;
    default:
      return <Text>[unknown]</Text>;
  }
}
