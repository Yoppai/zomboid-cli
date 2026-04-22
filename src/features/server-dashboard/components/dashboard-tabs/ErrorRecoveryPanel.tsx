import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { ErrorBox } from '@/shared/components/common/ErrorBox.tsx';
import { ConfirmDialog } from '@/shared/components/common/ConfirmDialog.tsx';
import { useServices } from '@/shared/hooks/use-services.tsx';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { AppServices } from '@/shared/hooks/use-services.tsx';
import { findMachineType } from '@/shared/infra/entities/machine-catalog.ts';
import type { ServerConfig } from '@/shared/infra/entities/value-objects.ts';

export interface ErrorRecoveryPanelProps {
  readonly server: ServerRecord;
}

export type RecoveryPhase = 1 | 2 | 3 | 4 | 5;

export type RecoveryActionId =
  | 'retry_deploy'
  | 'destroy_partial'
  | 'abort'
  | 'vm_diagnostics'
  | 'retry_vm_boot'
  | 'destroy'
  | 'view_cloud_init_logs'
  | 'rerun_bootstrap'
  | 'wait_longer'
  | 'view_logs'
  | 'restart_container'
  | 'reconfigure'
  | 'retry_operation'
  | 'ssh_manual'
  | 'archive';

const ALWAYS_VISIBLE_ACTIONS: readonly RecoveryActionId[] = [
  'retry_deploy',
  'archive',
  'ssh_manual',
];

const PHASE_ACTIONS: Record<RecoveryPhase, readonly RecoveryActionId[]> = {
  1: ['retry_deploy', 'destroy_partial', 'abort'],
  2: ['vm_diagnostics', 'retry_vm_boot', 'destroy'],
  3: ['view_cloud_init_logs', 'rerun_bootstrap', 'wait_longer', 'destroy'],
  4: ['view_logs', 'restart_container', 'reconfigure'],
  5: ['retry_operation'],
};

export function ErrorRecoveryPanel({ server }: ErrorRecoveryPanelProps) {
  const services = useServices();
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<RecoveryActionId | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const errorMsg = server.errorMessage || 'Unknown error occurred.';
  const phase = resolveRecoveryPhase(errorMsg);
  const errorCode = inferErrorCode(errorMsg, phase);
  const options = buildRecoveryActions(phase);

  const destructiveActions = new Set<RecoveryActionId>(['destroy_partial', 'destroy', 'archive']);

  const runAction = async (action: RecoveryActionId) => {
    const result = await executeRecoveryAction(action, server, services);
    if (result) {
      setInfoMessage(result);
    }
  };

  const handleAction = async (action: string) => {
    const typedAction = action as RecoveryActionId;
    if (destructiveActions.has(typedAction)) {
      setConfirmAction(typedAction);
      return;
    }

    setLoading(true);
    try {
      await runAction(typedAction);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box flexDirection="column" gap={1} borderStyle="single" borderColor="yellow" padding={1}>
      <Text bold color="yellow">Error Recovery Dashboard</Text>
      {confirmAction ? (
        <ConfirmDialog
          message={
              confirmAction === 'destroy'
              ? 'Destroy resources? This is destructive.'
              : confirmAction === 'destroy_partial'
                ? 'Destroy partial resources? This is destructive.'
                : 'Archive failed server? This is destructive.'
          }
          onCancel={() => setConfirmAction(null)}
          onConfirm={async () => {
            setLoading(true);
            setConfirmAction(null);
            try {
              await runAction(confirmAction);
            } catch (e) {
              console.error(e);
            } finally {
              setLoading(false);
            }
          }}
        />
      ) : loading ? (
        <Text>Executing recovery action...</Text>
      ) : (
        <ErrorBox
          code={errorCode!}
          message={errorMsg}
          options={options}
          onAction={handleAction}
        />
      )}
      {infoMessage ? <Text color="cyan">{infoMessage}</Text> : null}
    </Box>
  );
}

function inferErrorCode(errorMessage: string, phase: RecoveryPhase): string {
  const upper = errorMessage.toUpperCase();
  if (upper.includes('CDKTF') || upper.includes('TERRAFORM') || upper.includes('PROVISION')) {
    return 'CDKTF_APPLY_FAILURE';
  }
  if (upper.includes('VM BOOT TIMEOUT')) {
    return 'VM_BOOT_TIMEOUT';
  }
  if (upper.includes('CLOUD-INIT')) {
    return 'CLOUD_INIT_TIMEOUT';
  }
  if (upper.includes('CONTAINER') && (upper.includes('CRASH') || upper.includes('EXIT'))) {
    return 'CONTAINER_CRASH';
  }
  if (upper.includes('SSH') || upper.includes('RCON')) {
    return 'OPERATIONAL_ERROR';
  }
  return `PHASE_${phase}_ERROR`;
}

export function resolveRecoveryPhase(errorMessage: string): RecoveryPhase {
  const upper = errorMessage.toUpperCase();

  if (upper.includes('CDKTF') || upper.includes('TERRAFORM') || upper.includes('PROVISION') || upper.includes('APPLY')) {
    return 1;
  }

  if (upper.includes('VM BOOT TIMEOUT')) {
    return 2;
  }

  if (upper.includes('CLOUD-INIT')) {
    return 3;
  }

  if (upper.includes('CONTAINER') && (upper.includes('CRASH') || upper.includes('EXIT') || upper.includes('UNHEALTHY'))) {
    return 4;
  }

  if (upper.includes('SSH') || upper.includes('RCON')) {
    return 5;
  }

  return 5;
}

export function buildRecoveryActions(phase: RecoveryPhase): readonly RecoveryActionId[] {
  return Array.from(new Set<RecoveryActionId>([
    ...PHASE_ACTIONS[phase],
    ...ALWAYS_VISIBLE_ACTIONS,
  ]));
}

export async function executeRecoveryAction(
  action: RecoveryActionId,
  server: ServerRecord,
  services: AppServices,
): Promise<string | void> {
  switch (action) {
    case 'retry_deploy': {
      await retryDeployFlow(server, services);
      return;
    }

    case 'retry_vm_boot': {
      const instanceName = resolveInstanceName(server);
      await services.cloudProvider?.stopInstance?.(server.projectId, server.instanceZone, instanceName);
      await services.cloudProvider?.startInstance?.(server.projectId, server.instanceZone, instanceName);
      await services.localDb?.updateServer?.(server.id, {
        status: 'failed',
        errorMessage: 'VM reboot requested from recovery panel',
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    case 'retry_operation': {
      const conn = toSshConnection(server);
      await services.sshGateway?.testConnection?.(conn);
      return;
    }

    case 'rerun_bootstrap': {
      const conn = toSshConnection(server);
      await services.sshGateway?.exec?.(
        conn,
        'bash /var/lib/cloud/instance/scripts/user-data',
      );
      return;
    }

    case 'restart_container': {
      const conn = toSshConnection(server);
      await services.sshGateway?.exec?.(
        conn,
        'docker compose -f /opt/zomboid/docker-compose.yml restart',
      );
      return;
    }

    case 'wait_longer':
      await services.deploy?.startServer?.(server.id);
      return;

    case 'archive':
      await services.archive?.archive?.(server.id);
      return;

    case 'destroy_partial':
    case 'destroy': {
      await services.cloudProvider?.destroy?.(
        server.id,
        `zomboid-cli-tfstate-${server.projectId}`,
        server.projectId,
      );
      await services.localDb?.updateServer?.(server.id, {
        status: 'failed',
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    case 'abort':
      await services.localDb?.updateServer?.(server.id, {
        status: 'failed',
        updatedAt: new Date().toISOString(),
      });
      return;

    case 'vm_diagnostics': {
      const status = await services.cloudProvider?.getInstanceStatus?.(
        server.projectId,
        server.instanceZone,
        `zomboid-${server.name}`,
      );
      return `VM diagnostics status: ${status ?? 'UNKNOWN'}`;
    }

    case 'view_cloud_init_logs': {
      const conn = toSshConnection(server);
      const result = await services.sshGateway?.exec?.(conn, 'cat /var/log/cloud-init-output.log');
      const lineCount = String(result?.stdout ?? '').split('\n').filter(Boolean).length;
      return `Cloud-init logs fetched (${lineCount} lines)`;
    }

    case 'view_logs': {
      const conn = toSshConnection(server);
      const result = await services.sshGateway?.exec?.(
        conn,
        'docker logs --tail 50 zomboid-server 2>&1',
      );
      const lineCount = String(result?.stdout ?? '').split('\n').filter(Boolean).length;
      return `Container logs fetched (${lineCount} lines)`;
    }

    case 'reconfigure':
      await services.localDb?.updateServer?.(server.id, {
        errorMessage: 'Reconfiguration requested from recovery panel',
        updatedAt: new Date().toISOString(),
      });
      return;

    case 'ssh_manual':
      await openManualSshSession(server);
      return 'SSH manual diagnosis session finished';
  }
}

function toSshConnection(server: ServerRecord): {
  host: string;
  port: number;
  username: string;
  privateKey: string;
} {
  if (!server.staticIp) {
    throw new Error('Cannot open SSH diagnostics without static IP');
  }

  return {
    host: server.staticIp,
    port: 22,
    username: 'root',
    privateKey: server.sshPrivateKey,
  };
}

async function openManualSshSession(server: ServerRecord): Promise<void> {
  if (!server.staticIp) {
    throw new Error('Cannot open SSH session without static IP');
  }

  const proc = Bun.spawn({
    cmd: ['ssh', `root@${server.staticIp}`],
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  await proc.exited;
}

async function retryDeployFlow(server: ServerRecord, services: AppServices): Promise<void> {
  const deployFn = services.deploy as { deploy?: (cfg: ServerConfig) => Promise<unknown>; startServer?: (id: ServerRecord['id']) => Promise<void> };
  if (deployFn?.deploy) {
    await deployFn.deploy(buildRetryDeployConfig(server));
    return;
  }

  await deployFn?.startServer?.(server.id);
}

function buildRetryDeployConfig(server: ServerRecord): ServerConfig {
  const machineType = findMachineType(server.instanceType) ?? {
    id: server.instanceType,
    label: server.instanceType,
    totalRamGb: 8,
    serverMemoryGb: 6,
    maxPlayers: '1-8',
  };

  const zone = server.instanceZone;
  const region = zone.includes('-')
    ? zone.split('-').slice(0, 2).join('-')
    : zone;

  return {
    name: server.name,
    provider: server.provider,
    projectId: server.projectId,
    region,
    zone,
    machineType,
    gameBranch: server.gameBranch,
    rconPassword: server.rconPassword,
    sshPublicKey: 'recovery-public-key-unavailable',
    sshPrivateKey: server.sshPrivateKey,
  };
}

function resolveInstanceName(server: ServerRecord): string {
  return `zomboid-${server.name}`;
}
