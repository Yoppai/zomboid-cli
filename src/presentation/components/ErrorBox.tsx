import React from 'react';
import { Box, Text } from 'ink';
import { SelectList } from './SelectList.tsx';
import type { RecoveryOption } from '@/domain/entities/errors.ts';

// ── Recovery option labels ──

const RECOVERY_LABELS: Record<RecoveryOption | 'retry' | 'destroy' | 'ssh_manual' | 'abort' | 'reconfigure' | 'show_logs' | 'archive' | 'retry_deploy' | 'destroy_partial' | 'vm_diagnostics' | 'retry_vm_boot' | 'view_cloud_init_logs' | 'rerun_bootstrap' | 'wait_longer' | 'view_logs' | 'restart_container' | 'retry_operation', string> = {
  retry: 'Retry',
  destroy: 'Destroy',
  archive: 'Archive',
  ssh_manual: 'SSH',
  abort: 'Abort',
  reconfigure: 'Reconfigure',
  show_logs: 'Show Logs',
  retry_deploy: 'Retry Deploy',
  destroy_partial: 'Destroy Partial Resources',
  vm_diagnostics: 'VM Diagnostics',
  retry_vm_boot: 'Retry VM Boot',
  view_cloud_init_logs: 'View cloud-init logs',
  rerun_bootstrap: 'Re-run bootstrap',
  wait_longer: 'Wait longer',
  view_logs: 'View logs',
  restart_container: 'Restart container',
  retry_operation: 'Retry',
};

// ── Props ──

export interface ErrorBoxProps {
  readonly code: string;
  readonly message: string;
  readonly options: readonly (RecoveryOption | string)[];
  readonly onAction?: (action: RecoveryOption | string) => void;
}

// ── Component ──

export function ErrorBox({ code, message, options, onAction }: ErrorBoxProps) {
  const selectItems = options.map(opt => ({
    label: RECOVERY_LABELS[opt as keyof typeof RECOVERY_LABELS] || opt,
    value: opt
  }));

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1} gap={1}>
      <Text color="red" bold>✖ Error: {code}</Text>
      <Text>{message}</Text>
      
      {options.length > 0 && (
        <Box flexDirection="column">
          <Text bold color="yellow">Recovery Options:</Text>
          <SelectList items={selectItems} onSelect={onAction || (() => {})} />
        </Box>
      )}
    </Box>
  );
}
