// ── Barrel Export: Domain Entities ──

// Enums & Branded Types
export type {
  Provider,
  ServerStatus,
  GameBranch,
  TaskType,
  ServerId,
  TaskId,
} from './enums.ts';
export { createServerId, createTaskId } from './enums.ts';

// Value Objects
export type {
  MachineType,
  ServerConfig,
  RegionLatency,
  ContainerStats,
  RconResponse,
  BackupMeta,
  SshConnectionConfig,
  PlayerInfo,
} from './value-objects.ts';

// Entities
export type { ServerRecord } from './server-record.ts';
export { isValidStatusTransition } from './server-record.ts';
export type { ScheduledTask } from './scheduled-task.ts';
export type { Setting, SettingKey } from './setting.ts';

// Machine Catalog
export {
  GCP_MACHINE_CATALOG,
  calculateServerMemory,
  findMachineType,
} from './machine-catalog.ts';

// Errors
export type { RecoveryOption } from './errors.ts';
export {
  DomainError,
  SshConnectionError,
  SshCommandError,
  CdktfProvisionError,
  CdktfDestroyError,
  RconAuthError,
  RconConnectionError,
  SftpTransferError,
  DatabaseError,
  VmBootTimeoutError,
  CloudInitTimeoutError,
} from './errors.ts';
