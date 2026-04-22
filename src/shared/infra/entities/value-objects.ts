import type { Provider, GameBranch, ServerId } from './enums.ts';

// ── Value Objects (immutable, no identity) ──

export interface MachineType {
  readonly id: string;
  readonly label: string;
  readonly totalRamGb: number;
  readonly serverMemoryGb: number;
  readonly maxPlayers: string;
}

export interface ServerConfig {
  readonly name: string;
  readonly provider: Provider;
  readonly projectId: string;
  readonly region: string;
  readonly zone: string;
  readonly machineType: MachineType;
  readonly gameBranch: GameBranch;
  readonly rconPassword: string;
  readonly sshPublicKey: string;
  readonly sshPrivateKey: string;
}

export interface RegionLatency {
  readonly region: string;
  readonly zone: string;
  readonly latencyMs: number;
}

export interface ContainerStats {
  readonly cpuPercent: string;
  readonly memUsage: string;
  readonly memPercent: string;
  readonly netIO: string;
  readonly blockIO: string;
  readonly pids: number;
}

export interface RconResponse {
  readonly requestId: number;
  readonly body: string;
  readonly type: number;
}

export interface BackupMeta {
  readonly serverId: ServerId;
  readonly filename: string;
  readonly localPath: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

export interface SshConnectionConfig {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly privateKey: string;
}

export interface PlayerInfo {
  readonly username: string;
  readonly steamId?: string;
}
