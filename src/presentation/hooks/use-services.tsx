import React, { createContext, useContext } from 'react';
import type { InventoryService } from '@/application/services/inventory-service.ts';
import type { DeployService } from '@/application/services/deploy-service.ts';
import type { NotificationStore } from '@/presentation/store/notification-store.ts';

// ── Types ──

export interface AppServices {
  readonly inventory: InventoryService;
  readonly deploy: DeployService;
  readonly notificationStore: NotificationStore;
  readonly latency: any;
  readonly rcon: any;
  readonly stats: any;
  readonly backup: any;
  readonly updateFlow: any;
  readonly scheduler: any;
  readonly archive: any;
  readonly sshGateway?: any;
  readonly sftpGateway?: any;
  readonly cloudProvider?: any;
  readonly localDb?: any;
  readonly filePickerGateway?: any;
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
