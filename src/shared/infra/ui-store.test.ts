import { describe, it, expect, beforeEach } from 'bun:test';
import {
  createUiStore,
  type UiStore,
  type AppError,
  type ConfirmDialogConfig,
} from '@/shared/infra/ui-store.ts';

describe('UiStore', () => {
  let store: UiStore;

  beforeEach(() => {
    store = createUiStore();
  });

  // ── Initial State ──

  describe('initial state', () => {
    it('should start with loading=false, no error, no confirm dialog', () => {
      const state = store.getState();
      expect(state.loading).toBe(false);
      expect(state.loadingMessage).toBeNull();
      expect(state.error).toBeNull();
      expect(state.confirmDialog).toBeNull();
    });
  });

  // ── Loading ──

  describe('setLoading', () => {
    it('should set loading=true with a message', () => {
      store.getState().setLoading(true, 'Deploying server...');
      const state = store.getState();
      expect(state.loading).toBe(true);
      expect(state.loadingMessage).toBe('Deploying server...');
    });

    it('should set loading=true without a message', () => {
      store.getState().setLoading(true);
      const state = store.getState();
      expect(state.loading).toBe(true);
      expect(state.loadingMessage).toBeNull();
    });

    it('should clear loading and message when set to false', () => {
      store.getState().setLoading(true, 'Working...');
      store.getState().setLoading(false);
      const state = store.getState();
      expect(state.loading).toBe(false);
      expect(state.loadingMessage).toBeNull();
    });
  });

  // ── Error ──

  describe('setError', () => {
    it('should set an error with code and message', () => {
      const error: AppError = {
        code: 'SSH_CONNECTION_FAILED',
        message: 'SSH connection to 1.2.3.4 failed',
        recoveryOptions: ['retry', 'ssh_manual', 'abort'],
      };
      store.getState().setError(error);
      const state = store.getState();
      expect(state.error).not.toBeNull();
      expect(state.error!.code).toBe('SSH_CONNECTION_FAILED');
      expect(state.error!.message).toBe('SSH connection to 1.2.3.4 failed');
      expect(state.error!.recoveryOptions).toEqual(['retry', 'ssh_manual', 'abort']);
    });

    it('should clear error when set to null', () => {
      store.getState().setError({
        code: 'TEST',
        message: 'test error',
        recoveryOptions: [],
      });
      store.getState().setError(null);
      expect(store.getState().error).toBeNull();
    });

    it('should replace previous error', () => {
      store.getState().setError({ code: 'ERR_A', message: 'A', recoveryOptions: [] });
      store.getState().setError({ code: 'ERR_B', message: 'B', recoveryOptions: ['retry'] });
      expect(store.getState().error!.code).toBe('ERR_B');
    });
  });

  // ── Confirm Dialog ──

  describe('showConfirm / clearConfirm', () => {
    it('should set confirm dialog config', () => {
      const config: ConfirmDialogConfig = {
        message: 'Are you sure you want to archive?',
        onConfirm: () => {},
        onCancel: () => {},
      };
      store.getState().showConfirm(config);
      const state = store.getState();
      expect(state.confirmDialog).not.toBeNull();
      expect(state.confirmDialog!.message).toBe('Are you sure you want to archive?');
    });

    it('should clear confirm dialog', () => {
      store.getState().showConfirm({
        message: 'Delete?',
        onConfirm: () => {},
        onCancel: () => {},
      });
      store.getState().clearConfirm();
      expect(store.getState().confirmDialog).toBeNull();
    });

    it('should replace existing confirm dialog', () => {
      store.getState().showConfirm({
        message: 'First?',
        onConfirm: () => {},
        onCancel: () => {},
      });
      store.getState().showConfirm({
        message: 'Second?',
        onConfirm: () => {},
        onCancel: () => {},
      });
      expect(store.getState().confirmDialog!.message).toBe('Second?');
    });
  });

  // ── Combined state interactions ──

  describe('combined interactions', () => {
    it('should allow loading and error to coexist', () => {
      store.getState().setLoading(true, 'Working...');
      store.getState().setError({
        code: 'TIMEOUT',
        message: 'Timed out',
        recoveryOptions: ['retry'],
      });
      const state = store.getState();
      expect(state.loading).toBe(true);
      expect(state.error).not.toBeNull();
    });

    it('should allow confirm dialog during loading', () => {
      store.getState().setLoading(true);
      store.getState().showConfirm({
        message: 'Cancel operation?',
        onConfirm: () => {},
        onCancel: () => {},
      });
      const state = store.getState();
      expect(state.loading).toBe(true);
      expect(state.confirmDialog).not.toBeNull();
    });
  });
});
