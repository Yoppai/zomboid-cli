import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { Header } from '@/shared/components/common/Header.tsx';
import { TabBar } from '@/shared/components/common/TabBar.tsx';
import { KeyHint } from '@/shared/components/common/KeyHint.tsx';
import { useServer } from '@/features/server-dashboard/hooks/use-server';
import { ServerManagement } from '@/features/server-dashboard/components/dashboard-tabs/ServerManagement';
import { BuildSelect } from '@/features/server-dashboard/components/dashboard-tabs/BuildSelect';
import { PlayerManagement } from '@/features/server-dashboard/components/dashboard-tabs/PlayerManagement';
import { ServerStats } from '@/features/server-dashboard/components/dashboard-tabs/ServerStats';
import { BasicSettings } from '@/features/server-dashboard/components/dashboard-tabs/BasicSettings';
import { AdvancedSettings } from '@/features/server-dashboard/components/dashboard-tabs/AdvancedSettings';
import { AdminSettings } from '@/features/server-dashboard/components/dashboard-tabs/AdminSettings';
import { SchedulerPanel } from '@/features/scheduler/components/SchedulerPanel';
import { BackupsPanel } from '@/features/backups/components/BackupsPanel';
import { ErrorRecoveryPanel } from '@/features/server-dashboard/components/dashboard-tabs/ErrorRecoveryPanel';
import type { NavigationStore } from '@/shared/infra/navigation-store.ts';

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
