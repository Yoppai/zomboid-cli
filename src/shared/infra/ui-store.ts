import { createStore } from 'zustand/vanilla';
import type { RecoveryOption } from '@/shared/infra/entities/index.ts';

// ── Types ──

export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly recoveryOptions: readonly RecoveryOption[];
}

export interface ConfirmDialogConfig {
  readonly message: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export interface UiState {
  loading: boolean;
  loadingMessage: string | null;
  error: AppError | null;
  confirmDialog: ConfirmDialogConfig | null;
  // Shell overlay state
  modalState: 'closed' | 'wizard' | 'confirm';
  dimmed: boolean;
  footerHints: readonly string[];
  setLoading: (loading: boolean, message?: string) => void;
  setError: (error: AppError | null) => void;
  showConfirm: (config: ConfirmDialogConfig) => void;
  clearConfirm: () => void;
  openWizard: () => void;
  closeWizard: () => void;
  setDimmed: (dimmed: boolean) => void;
  setFooterHints: (hints: readonly string[]) => void;
  clearFooterHints: () => void;
}

export type UiStore = ReturnType<typeof createUiStore>;

// ── Factory ──

export function createUiStore() {
  return createStore<UiState>((set) => ({
    loading: false,
    loadingMessage: null,
    error: null,
    confirmDialog: null,
    modalState: 'closed',
    dimmed: false,
    footerHints: [],

    setLoading: (loading, message) =>
      set({
        loading,
        loadingMessage: loading ? (message ?? null) : null,
      }),

    setError: (error) => set({ error }),

    showConfirm: (config) => set({ confirmDialog: config, modalState: 'confirm', dimmed: true }),

    clearConfirm: () => set({ confirmDialog: null, modalState: 'closed', dimmed: false }),

    openWizard: () => set({ modalState: 'wizard', dimmed: true }),

    closeWizard: () => set({ modalState: 'closed', dimmed: false }),

    setDimmed: (dimmed) => set({ dimmed }),

    setFooterHints: (hints) => set({ footerHints: hints }),

    clearFooterHints: () => set({ footerHints: [] }),
  }));
}
