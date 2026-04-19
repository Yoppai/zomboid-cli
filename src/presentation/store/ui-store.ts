import { createStore } from 'zustand/vanilla';
import type { RecoveryOption } from '@/domain/entities/index.ts';

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
  setLoading: (loading: boolean, message?: string) => void;
  setError: (error: AppError | null) => void;
  showConfirm: (config: ConfirmDialogConfig) => void;
  clearConfirm: () => void;
}

export type UiStore = ReturnType<typeof createUiStore>;

// ── Factory ──

export function createUiStore() {
  return createStore<UiState>((set) => ({
    loading: false,
    loadingMessage: null,
    error: null,
    confirmDialog: null,

    setLoading: (loading, message) =>
      set({
        loading,
        loadingMessage: loading ? (message ?? null) : null,
      }),

    setError: (error) => set({ error }),

    showConfirm: (config) => set({ confirmDialog: config }),

    clearConfirm: () => set({ confirmDialog: null }),
  }));
}
