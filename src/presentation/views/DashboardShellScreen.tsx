import React, { useEffect, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useSyncExternalStore } from 'react';
import { ShellFrame } from '@/presentation/components/shell/ShellFrame.tsx';
import { ShellHeader } from '@/presentation/components/shell/ShellHeader.tsx';
import { SidebarNav } from '@/presentation/components/shell/SidebarNav.tsx';
import { ContentFrame } from '@/presentation/components/shell/ContentFrame.tsx';
import { ShellFooter } from '@/presentation/components/shell/ShellFooter.tsx';
import { OverlayHost } from '@/presentation/components/shell/OverlayHost.tsx';
import { createNavigationStore, type ShellContext, type ServerTabKey, type FocusRegion } from '@/presentation/store/navigation-store.ts';
import type { ServerId } from '@/domain/entities/index.ts';
import { createServerStore } from '@/presentation/store/server-store.ts';
import { createUiStore } from '@/presentation/store/ui-store.ts';
import { createWizardStore } from '@/presentation/store/wizard-store.ts';
import { useServices } from '@/presentation/hooks/use-services.tsx';
import { ActiveServersPanel } from '@/presentation/panels/ActiveServersPanel.tsx';
import { ArchivedServersPanel } from '@/presentation/panels/ArchivedServersPanel.tsx';
import { GlobalSettingsPanel } from '@/presentation/panels/GlobalSettingsPanel.tsx';
import { ConfirmDialog } from '@/presentation/components/ConfirmDialog.tsx';
import { ServerManagement } from './dashboard-tabs/ServerManagement.tsx';
import { BuildSelect } from './dashboard-tabs/BuildSelect.tsx';
import { PlayerManagement } from './dashboard-tabs/PlayerManagement.tsx';
import { ServerStats } from './dashboard-tabs/ServerStats.tsx';
import { BasicSettings } from './dashboard-tabs/BasicSettings.tsx';
import { AdvancedSettings } from './dashboard-tabs/AdvancedSettings.tsx';
import { AdminSettings } from './dashboard-tabs/AdminSettings.tsx';
import { SchedulerPanel } from './dashboard-tabs/SchedulerPanel.tsx';
import { BackupsPanel } from './dashboard-tabs/BackupsPanel.tsx';
import { SetupWizard } from './SetupWizard.tsx';

const VERSION = '0.1.0';

export interface DashboardShellScreenProps {
  readonly navStore?: ReturnType<typeof createNavigationStore>;
  readonly serverStore?: ReturnType<typeof createServerStore>;
  readonly uiStore?: ReturnType<typeof createUiStore>;
  readonly wizardStore?: ReturnType<typeof createWizardStore>;
}

export function DashboardShellScreen({
  navStore: navStoreProp,
  serverStore: serverStoreProp,
  uiStore: uiStoreProp,
  wizardStore: wizardStoreProp,
}: DashboardShellScreenProps) {
  const navStore = navStoreProp ?? useMemo(() => createNavigationStore(), []);
  const serverStore = serverStoreProp ?? useMemo(() => createServerStore(), []);
  const uiStore = uiStoreProp ?? useMemo(() => createUiStore(), []);
  const wizardStore = wizardStoreProp ?? useMemo(() => createWizardStore(), []);
  const { exit } = useApp();
  const { inventory } = useServices();

  // Subscribe to stores
  const context = useSyncExternalStore(
    (cb) => navStore.subscribe(cb),
    () => navStore.getState().contextStack[navStore.getState().contextStack.length - 1]!,
  );

  const focusRegion = useSyncExternalStore(
    (cb) => navStore.subscribe(cb),
    () => navStore.getState().focusRegion,
  );

  const modalState = useSyncExternalStore(
    (cb) => uiStore.subscribe(cb),
    () => uiStore.getState().modalState,
  );

  const dimmed = useSyncExternalStore(
    (cb) => uiStore.subscribe(cb),
    () => uiStore.getState().dimmed,
  );

  const footerHints = useSyncExternalStore(
    (cb) => uiStore.subscribe(cb),
    () => uiStore.getState().footerHints,
  );

  const servers = useSyncExternalStore(
    (cb) => serverStore.subscribe(cb),
    () => serverStore.getState().servers,
  );

  const confirmDialog = useSyncExternalStore(
    (cb) => uiStore.subscribe(cb),
    () => uiStore.getState().confirmDialog,
  );

  // Hydrate server list on mount
  useEffect(() => {
    inventory.listActive().then((active) => {
      serverStore.getState().hydrateActive(active);
      serverStore.getState().hydrate(active);
    }).catch(console.error);
    inventory.listArchived().then((archived) => {
      serverStore.getState().hydrateArchived(archived);
    }).catch(console.error);
  }, [inventory, serverStore]);

  // Gated useInput — owner determined by focusRegion + modalState
  useInput((input, key) => {
    // Modal takes all input
    if (modalState !== 'closed') {
      if (key.escape) {
        if (modalState === 'wizard') {
          uiStore.getState().closeWizard();
        } else if (modalState === 'confirm') {
          uiStore.getState().clearConfirm();
        }
      }
      return;
    }

  // ESC: hierarchical — modal close → sidebar return → context pop
  if (key.escape) {
    const topContext = navStore.getState().contextStack[navStore.getState().contextStack.length - 1]!;
    const currentFocus = navStore.getState().focusRegion;

    // Step 1: If in server context with main focused, return focus to sidebar first
    if (topContext.kind === 'server' && currentFocus === 'main') {
      navStore.getState().setFocus('sidebar');
      return;
    }

    // Step 2: If in server context with sidebar focused, pop to main context
    if (topContext.kind === 'server' && currentFocus === 'sidebar') {
      navStore.getState().popContext();
      navStore.getState().setFocus('sidebar');
      return;
    }

    // Step 3: If in main context but not on active-servers panel, pop back to it
    if (topContext.kind === 'main' && topContext.panel !== 'active-servers') {
      navStore.getState().popContext();
      navStore.getState().setFocus('sidebar');
      return;
    }
    return;
  }

    // Tab: cycle focus sidebar ↔ main
    if (key.tab) {
      const current = navStore.getState().focusRegion;
      navStore.getState().setFocus(current === 'sidebar' ? 'main' : 'sidebar');
      return;
    }
  }, { isActive: modalState === 'closed' });

  const handleSidebarSelect = (key: string) => {
    if (key === 'create_server') {
      uiStore.getState().openWizard();
      return;
    }
    navStore.getState().selectSidebarItem(key);
  };

  const handleServerTabSelect = (tab: string) => {
    navStore.getState().selectServerTab(tab as ServerTabKey);
  };

  const handleServerSelect = (serverId: string) => {
    navStore.getState().pushContext({ kind: 'server', serverId: serverId as ServerId, tab: 'management' });
  };

  const activeCount = servers.filter((s) => s.status === 'running').length;
  const totalCount = servers.length;

  return (
    <ShellFrame>
      <ShellHeader version={VERSION} activeCount={activeCount} totalCount={totalCount} />
      <Box flexGrow={1}>
        <SidebarNav
          context={context}
          focusRegion={focusRegion}
          onSelect={handleSidebarSelect}
          onServerSelect={handleServerTabSelect}
        />
        <ContentFrame context={context}>
          {renderContent(context, navStore, serverStore, uiStore, handleServerSelect, focusRegion)}
        </ContentFrame>
      </Box>
      <ShellFooter hints={footerHints} />
      <OverlayHost dimmed={dimmed}>
        {modalState === 'wizard' && (
          <SetupWizard navStore={navStore} wizardStore={wizardStore} uiStore={uiStore} />
        )}
      </OverlayHost>
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
          variant="modal"
        />
      )}
    </ShellFrame>
  );
}

function renderContent(
  context: ShellContext,
  navStore: ReturnType<typeof createNavigationStore>,
  serverStore: ReturnType<typeof createServerStore>,
  uiStore: ReturnType<typeof createUiStore>,
  handleServerSelect: (serverId: string) => void,
  focusRegion: FocusRegion,
) {
  if (context.kind === 'main') {
    switch (context.panel) {
      case 'active-servers':
        return <ActiveServersPanel serverStore={serverStore} navStore={navStore} onServerSelect={handleServerSelect} />;
      case 'archived':
        return <ArchivedServersPanel serverStore={serverStore} navStore={navStore} />;
      case 'global-settings':
        return <GlobalSettingsPanel navStore={navStore} focused={focusRegion === 'main'} />;
    }
  }

  if (context.kind === 'server') {
    return (
      <ServerTabContent
        serverId={context.serverId}
        tab={context.tab}
        serverStore={serverStore}
        navStore={navStore}
        focusRegion={focusRegion}
      />
    );
  }

  return null;
}

// Server tab content renderer — reuses existing dashboard tab components
function ServerTabContent({
  serverId,
  tab,
  serverStore,
  navStore,
  focusRegion,
}: {
  serverId: string;
  tab: ServerTabKey;
  serverStore: ReturnType<typeof createServerStore>;
  navStore: ReturnType<typeof createNavigationStore>;
  focusRegion: FocusRegion;
}) {
  const server = serverStore.getState().servers.find((s) => s.id === serverId);
  const isFocused = focusRegion === 'main';

  if (!server) {
    return <Box><Text color="red">Server not found</Text></Box>;
  }

  switch (tab) {
    case 'management':
      return <ServerManagement server={server} focused={isFocused} />;
    case 'build':
      return <BuildSelect server={server} focused={isFocused} />;
    case 'players':
      return <PlayerManagement server={server} isActive={tab === 'players'} focused={isFocused} />;
    case 'stats':
      return <ServerStats server={server} isActive={tab === 'stats'} focused={isFocused} />;
    case 'basic':
      return <BasicSettings server={server} />;
    case 'advanced':
      return <AdvancedSettings server={server} />;
    case 'admins':
      return <AdminSettings server={server} />;
    case 'scheduler':
      return <SchedulerPanel server={server} focused={isFocused} />;
    case 'backups':
      return <BackupsPanel server={server} focused={isFocused} />;
    default:
      return <ServerManagement server={server} focused={isFocused} />;
  }
}
