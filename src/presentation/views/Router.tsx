import React from 'react';
import { DashboardShellScreen } from '@/presentation/views/DashboardShellScreen.tsx';

// Router always renders the persistent dashboard shell.
// Legacy screen-stack routing has been removed.
export function Router() {
  return <DashboardShellScreen />;
}
