import React from 'react';
import { DashboardShellScreen } from '@/features/server-dashboard/components/DashboardShellScreen';

// Router always renders the persistent dashboard shell.
// Legacy screen-stack routing has been removed.
export function Router() {
  return <DashboardShellScreen />;
}
