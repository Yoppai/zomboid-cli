import type { SshConnectionConfig } from '../entities/value-objects.ts';

// ── Command Result ──

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

// ── SSH Gateway Port ──

export interface ISshGateway {
  /** Execute a single command on the remote host */
  exec(conn: SshConnectionConfig, command: string): Promise<CommandResult>;

  /** Execute command and stream stdout line-by-line via callback */
  execStream(
    conn: SshConnectionConfig,
    command: string,
    onData: (line: string) => void,
    signal?: AbortSignal,
  ): Promise<void>;

  /** Create an SSH tunnel: localPort → remoteHost:remotePort */
  createTunnel(
    conn: SshConnectionConfig,
    localPort: number,
    remoteHost: string,
    remotePort: number,
  ): Promise<{ close: () => void }>;

  /** Test SSH connectivity (returns true if reachable) */
  testConnection(conn: SshConnectionConfig): Promise<boolean>;

  /** Disconnect and clean up all pooled connections for a host */
  disconnect(host: string): Promise<void>;

  /** Disconnect all pooled connections */
  disconnectAll(): Promise<void>;
}
