import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { Header } from '@/presentation/components/Header.tsx';
import { TabBar } from '@/presentation/components/TabBar.tsx';
import { KeyHint } from '@/presentation/components/KeyHint.tsx';
import { useServer } from '@/presentation/hooks/use-server.ts';
import { ServerManagement } from './dashboard-tabs/ServerManagement.tsx';
import { BuildSelect } from './dashboard-tabs/BuildSelect.tsx';
import { PlayerManagement } from './dashboard-tabs/PlayerManagement.tsx';
import { ServerStats } from './dashboard-tabs/ServerStats.tsx';
import { BasicSettings } from './dashboard-tabs/BasicSettings.tsx';
import { AdvancedSettings } from './dashboard-tabs/AdvancedSettings.tsx';
import { AdminSettings } from './dashboard-tabs/AdminSettings.tsx';
import { SchedulerPanel } from './dashboard-tabs/SchedulerPanel.tsx';
import { BackupsPanel } from './dashboard-tabs/BackupsPanel.tsx';
import { ErrorRecoveryPanel } from './dashboard-tabs/ErrorRecoveryPanel.tsx';
import type { NavigationStore } from '@/presentation/store/navigation-store.ts';

export interface ServerDashboardProps {
  readonly navigationStore?: NavigationStore; // Make it optional for tests
  readonly serverId: string;
}

const TABS = [
  'Management',
  'Build',
  'Players',
  'Stats',
  'Basic',
  'Advanced',
  'Admins',
  'Scheduler',
  'Backups',
];

export function ServerDashboard({ navigationStore, serverId }: ServerDashboardProps) {
  const { server, loading, error } = useServer(serverId);
  const [activeTab, setActiveTab] = useState(0);

  if (loading) {
    return <Text>Loading dashboard...</Text>;
  }

  if (error || !server) {
    return <Text color="red">Failed to load server: {error?.message}</Text>;
  }

  return (
    <Box flexDirection="column" flexGrow={1} gap={1}>
      <Header title={`Dashboard: ${server.name}`} breadcrumb={[server.status]} />
      
      {server.status === 'failed' ? (
        <ErrorRecoveryPanel server={server} />
      ) : (
        <>
          <TabBar
            tabs={TABS}
            activeIndex={activeTab}
            onTabChange={setActiveTab}
          />
          
          <Box flexGrow={1} paddingX={1} borderStyle="single">
            {activeTab === 0 && <ServerManagement server={server} />}
            {activeTab === 1 && <BuildSelect server={server} />}
            {activeTab === 2 && <PlayerManagement server={server} />}
            {activeTab === 3 && <ServerStats server={server} />}
            {activeTab === 4 && <BasicSettings server={server} />}
            {activeTab === 5 && <AdvancedSettings server={server} />}
            {activeTab === 6 && <AdminSettings server={server} />}
            {activeTab === 7 && <SchedulerPanel server={server} />}
            {activeTab === 8 && <BackupsPanel server={server} />}
          </Box>
        </>
      )}
      
      <KeyHint hints={[
        { key: '←/→', label: 'Tabs' },
        { key: 'ESC', label: 'Back' }
      ]} />
    </Box>
  );
}
