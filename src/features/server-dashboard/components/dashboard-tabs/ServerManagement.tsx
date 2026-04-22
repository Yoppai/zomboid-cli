import React from 'react';
import { useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { SelectList } from '@/shared/components/common/SelectList.tsx';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import { useServices } from '@/shared/hooks/use-services.tsx';
import { ConfirmDialog } from '@/shared/components/common/ConfirmDialog.tsx';
import { GCP_MACHINE_CATALOG } from '@/shared/infra/entities/machine-catalog.ts';
import type { MachineType } from '@/shared/infra/entities/value-objects.ts';

export interface ServerManagementProps {
  readonly server: ServerRecord;
  readonly focused?: boolean;
}

export function ServerManagement({ server, focused }: ServerManagementProps) {
  const { deploy, updateFlow, archive } = useServices();
  const [confirmAction, setConfirmAction] = useState<null | 'update' | 'archive' | 'change-instance'>(null);
  const [selectingInstance, setSelectingInstance] = useState(false);
  const [pendingMachineType, setPendingMachineType] = useState<MachineType | null>(null);
  const [runningAction, setRunningAction] = useState(false);

  const handleAction = async (val: string) => {
    if (val === 'start') {
      await deploy.startServer(server.id);
      return;
    }

    if (val === 'stop') {
      await deploy.stopServer(server.id);
      return;
    }

    if (val === 'update') {
      setConfirmAction('update');
      return;
    }

    if (val === 'archive') {
      setConfirmAction('archive');
      return;
    }

    if (val === 'change-instance') {
      setSelectingInstance(true);
    }
  };

  const actions = [] as Array<{ label: string; value: string }>;
  if (server.status === 'stopped') {
    actions.push({ label: 'Start Server', value: 'start' });
    actions.push({ label: 'Graceful Update', value: 'update' });
    actions.push({ label: 'Change Instance Type', value: 'change-instance' });
    actions.push({ label: 'Archive Server', value: 'archive' });
  } else if (server.status === 'running') {
    actions.push({ label: 'Stop Server', value: 'stop' });
    actions.push({ label: 'Graceful Update', value: 'update' });
    actions.push({ label: 'Change Instance Type', value: 'change-instance' });
    actions.push({ label: 'Archive Server', value: 'archive' });
  } else if (server.status === 'failed') {
    actions.push({ label: 'Graceful Update', value: 'update' });
    actions.push({ label: 'Change Instance Type', value: 'change-instance' });
    actions.push({ label: 'Archive Server', value: 'archive' });
  }

  const targetMachineTypes = useMemo(
    () => GCP_MACHINE_CATALOG.filter((machineType) => machineType.id !== server.instanceType),
    [server.instanceType],
  );

  if (runningAction) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Management Actions</Text>
        <Text>Executing action...</Text>
      </Box>
    );
  }

  if (selectingInstance) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Select Target Instance Type</Text>
      <SelectList
items={targetMachineTypes.map((machineType) => ({
          label: `${machineType.label} (${machineType.id})`,
          value: machineType.id,
        }))}
        focused={focused}
        onSelect={(value) => {
            const selected = targetMachineTypes.find((machineType) => machineType.id === value) ?? null;
            setPendingMachineType(selected);
            setConfirmAction('change-instance');
            setSelectingInstance(false);
          }}
        />
      </Box>
    );
  }

  if (confirmAction) {
    const message =
      confirmAction === 'archive'
        ? 'Archive server? This destroys infrastructure after backup.'
        : confirmAction === 'update'
          ? 'Run graceful update now?'
          : `Change instance type to ${pendingMachineType?.id ?? 'selected'}?`;

    return (
      <ConfirmDialog
        message={message}
        onCancel={() => {
          setConfirmAction(null);
          setPendingMachineType(null);
        }}
        onConfirm={async () => {
          setRunningAction(true);
          try {
            if (confirmAction === 'archive') {
              await archive?.archive(server.id);
            } else if (confirmAction === 'update') {
              await updateFlow?.gracefulUpdate(server.id);
            } else if (confirmAction === 'change-instance' && pendingMachineType) {
              await deploy.changeInstanceType(server.id, pendingMachineType);
            }
          } finally {
            setRunningAction(false);
            setConfirmAction(null);
            setPendingMachineType(null);
          }
        }}
      />
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Management Actions</Text>
      <Text>Current Status: {server.status}</Text>
      <Text>IP Address: {server.staticIp || 'N/A'}</Text>
      
      {actions.length > 0 ? (
        <SelectList items={actions} onSelect={handleAction} focused={focused} />
      ) : (
        <Text>No actions available in current status.</Text>
      )}
    </Box>
  );
}
