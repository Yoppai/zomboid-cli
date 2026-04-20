import { describe, it, expect, beforeEach } from 'bun:test';
import { createUiStore, type UiStore } from '@/presentation/store/ui-store.ts';

describe('UiStore — Overlay State', () => {
  let store: UiStore;

  beforeEach(() => {
    store = createUiStore();
  });

  describe('initial overlay state', () => {
    it('should start with modalState=closed', () => {
      expect(store.getState().modalState).toBe('closed');
    });

    it('should start with dimmed=false', () => {
      expect(store.getState().dimmed).toBe(false);
    });

    it('should start with empty footerHints', () => {
      expect(store.getState().footerHints).toEqual([]);
    });
  });

  describe('openWizard / closeWizard', () => {
    it('should set modalState=wizard on open', () => {
      store.getState().openWizard();
      expect(store.getState().modalState).toBe('wizard');
    });

    it('should set dimmed=true on open', () => {
      store.getState().openWizard();
      expect(store.getState().dimmed).toBe(true);
    });

    it('should close wizard', () => {
      store.getState().openWizard();
      store.getState().closeWizard();
      expect(store.getState().modalState).toBe('closed');
    });

    it('should undim on close', () => {
      store.getState().openWizard();
      store.getState().closeWizard();
      expect(store.getState().dimmed).toBe(false);
    });
  });

  describe('showConfirm / clearConfirm', () => {
    it('should set modalState=confirm and dimmed=true', () => {
      store.getState().showConfirm({ message: 'Delete?', onConfirm: () => {}, onCancel: () => {} });
      expect(store.getState().modalState).toBe('confirm');
      expect(store.getState().dimmed).toBe(true);
    });

    it('should clear confirm dialog', () => {
      store.getState().showConfirm({ message: 'Delete?', onConfirm: () => {}, onCancel: () => {} });
      store.getState().clearConfirm();
      expect(store.getState().modalState).toBe('closed');
      expect(store.getState().dimmed).toBe(false);
    });
  });

  describe('footerHints', () => {
    it('should set footer hints', () => {
      store.getState().setFooterHints(['[Ctrl+C] Quit']);
      expect(store.getState().footerHints).toEqual(['[Ctrl+C] Quit']);
    });

    it('should clear footer hints', () => {
      store.getState().setFooterHints(['[Ctrl+C] Quit']);
      store.getState().clearFooterHints();
      expect(store.getState().footerHints).toEqual([]);
    });
  });
});
