import { describe, it, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';

// Production code that does NOT exist yet — guarantees RED
import {
  ServiceProvider,
  useServices,
  type AppServices,
} from '@/presentation/hooks/use-services.tsx';

// ── Mock services factory ──

function createMockServices(): AppServices {
  return {
    inventory: { listServers: async () => [], getServer: async () => null } as any,
    deploy: { deploy: async () => ({}) } as any,
    latency: { measureAllRegions: async () => [] } as any,
    rcon: { connect: async () => {} } as any,
    stats: { getContainerStats: async () => ({}) } as any,
    backup: { create: async () => ({}) } as any,
    updateFlow: { gracefulUpdate: async () => {} } as any,
    scheduler: { addTask: async () => {} } as any,
    archive: { archive: async () => {} } as any,
    notificationStore: { getState: () => ({ add: () => {} }) } as any,
  };
}

// ── Tests ──

describe('ServiceProvider + useServices', () => {
  describe('useServices outside provider', () => {
    it('should throw when used outside ServiceProvider', () => {
      // Test the hook logic directly — calling useServices() outside a provider
      // React 19 swallows render-time errors, so we test the error rendering path
      let threwError = false;

      function BadComponent() {
        try {
          const services = useServices();
          return React.createElement(Text, null, 'Should not render');
        } catch (e: any) {
          threwError = true;
          return React.createElement(Text, null, e.message);
        }
      }

      const { lastFrame } = render(React.createElement(BadComponent));
      expect(threwError).toBe(true);
      expect(lastFrame()).toContain('useServices must be used within a ServiceProvider');
    });
  });

  describe('useServices inside provider', () => {
    it('should provide all services to children', () => {
      const mockServices = createMockServices();
      let capturedServices: AppServices | null = null;

      function TestConsumer() {
        capturedServices = useServices();
        return React.createElement(Text, null, 'has services');
      }

      const { lastFrame } = render(
        React.createElement(
          ServiceProvider,
          { services: mockServices },
          React.createElement(TestConsumer),
        ),
      );

      expect(lastFrame()).toContain('has services');
      expect(capturedServices).not.toBeNull();
      expect(capturedServices!.inventory).toBe(mockServices.inventory);
      expect(capturedServices!.deploy).toBe(mockServices.deploy);
      expect(capturedServices!.rcon).toBe(mockServices.rcon);
      expect(capturedServices!.stats).toBe(mockServices.stats);
      expect(capturedServices!.backup).toBe(mockServices.backup);
      expect(capturedServices!.archive).toBe(mockServices.archive);
    });

    it('should provide latency and scheduler services', () => {
      const mockServices = createMockServices();
      let capturedServices: AppServices | null = null;

      function TestConsumer() {
        capturedServices = useServices();
        return React.createElement(Text, null, 'ok');
      }

      render(
        React.createElement(
          ServiceProvider,
          { services: mockServices },
          React.createElement(TestConsumer),
        ),
      );

      expect(capturedServices).not.toBeNull();
      expect(capturedServices!.latency).toBe(mockServices.latency);
      expect(capturedServices!.scheduler).toBe(mockServices.scheduler);
      expect(capturedServices!.updateFlow).toBe(mockServices.updateFlow);
    });
  });
});
