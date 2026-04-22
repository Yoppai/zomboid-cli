import type { ServerId } from './enums.ts';
import type { Provider, ServerStatus, GameBranch } from './enums.ts';

export interface ServerRecord {
  readonly id: ServerId;
  readonly name: string;
  readonly provider: Provider;
  readonly projectId: string;
  readonly instanceType: string;
  readonly instanceZone: string;
  readonly staticIp: string | null;
  readonly sshPrivateKey: string;
  readonly rconPassword: string;
  readonly gameBranch: GameBranch;
  status: ServerStatus;
  errorMessage: string | null;
  backupPath: string | null;
  readonly createdAt: string;
  updatedAt: string;
}

// ── Status Transition Validator ──

const VALID_TRANSITIONS: Record<ServerStatus, readonly ServerStatus[]> = {
  provisioning: ['running', 'failed'],
  running: ['stopped', 'failed'],
  stopped: ['running', 'failed', 'archived'],
  failed: ['provisioning', 'archived'],
  archived: [], // terminal — no transitions allowed
};

export function isValidStatusTransition(
  from: ServerStatus,
  to: ServerStatus,
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}
