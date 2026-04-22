import type { RconResponse } from '../entities/value-objects.ts';

// ── RCON Gateway Port ──

export interface IRconGateway {
  /** Connect to RCON server (via already-open SSH tunnel on localhost:localPort) */
  connect(host: string, port: number, password: string): Promise<void>;

  /** Send RCON command and receive parsed response */
  sendCommand(command: string): Promise<RconResponse>;

  /** Disconnect RCON session */
  disconnect(): Promise<void>;

  /** Check if currently connected */
  isConnected(): boolean;
}
