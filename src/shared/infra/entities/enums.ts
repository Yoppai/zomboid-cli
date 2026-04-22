// ── Type Aliases (union types) ──

export type Provider = 'gcp' | 'aws' | 'azure';

export type ServerStatus =
  | 'provisioning'
  | 'running'
  | 'stopped'
  | 'failed'
  | 'archived';

export type GameBranch = 'stable' | 'unstable' | 'outdatedunstable';

export type TaskType = 'auto_restart' | 'auto_backup' | 'broadcast';

// ── Branded Types ──

export type ServerId = string & { readonly __brand: 'ServerId' };
export type TaskId = string & { readonly __brand: 'TaskId' };

// ── Factory Helpers ──

export function createServerId(id: string): ServerId {
  return id as ServerId;
}

export function createTaskId(id: string): TaskId {
  return id as TaskId;
}
