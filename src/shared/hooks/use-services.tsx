import React, { createContext, useContext } from 'react';
import type { InventoryService } from '@/features/server-dashboard/services/inventory-service';
import type { DeployService } from '@/features/server-deploy/services/deploy-service.ts';
import type { LatencyService } from '@/features/server-dashboard/services/latency-service';
import type { RconService } from '@/features/server-dashboard/services/rcon-service';
import type { StatsService } from '@/features/server-dashboard/services/stats-service';
import type { BackupService } from '@/features/backups/services/backup-service.ts';
import type { UpdateFlowService } from '@/features/server-deploy/services/update-flow-service.ts';
import type { SchedulerService } from '@/features/scheduler/services/scheduler-service.ts';
import type { ArchiveService } from '@/features/archive/services/archive-service.ts';
import type { NotificationStore } from '@/shared/infra/notification-store.ts';
import type { ISshGateway } from '@/shared/infra/contracts/i-ssh-gateway.ts';
import type { ISftpGateway } from '@/shared/infra/contracts/i-sftp-gateway.ts';
import type { ICloudProvider } from '@/shared/infra/contracts/i-cloud-provider.ts';
import type { ILocalDb } from '@/shared/infra/contracts/i-local-db.ts';
import type { IFilePickerGateway } from '@/shared/infra/contracts/i-file-picker-gateway.ts';

// ── Types ──

export interface AppServices {
  readonly inventory: InventoryService;
  readonly deploy: DeployService;
  readonly latency: LatencyService;
  readonly rcon: RconService;
  readonly stats: StatsService;
  readonly backup: BackupService;
  readonly updateFlow: UpdateFlowService;
  readonly scheduler: SchedulerService;
  readonly archive: ArchiveService;
  readonly notificationStore: NotificationStore;
  readonly sshGateway?: ISshGateway;
  readonly sftpGateway?: ISftpGateway;
  readonly cloudProvider?: ICloudProvider;
  readonly localDb?: ILocalDb;
  readonly filePickerGateway?: IFilePickerGateway;
}

// ── Context ──

const ServiceContext = createContext<AppServices | null>(null);

// ── Provider ──

export interface ServiceProviderProps {
  services: AppServices;
  children?: React.ReactNode;
}

export function ServiceProvider({ services, children }: ServiceProviderProps) {
  return React.createElement(
    ServiceContext.Provider,
    { value: services },
    children,
  );
}

// ── Hook ──

export function useServices(): AppServices {
  const ctx = useContext(ServiceContext);
  if (ctx === null) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return ctx;
}
