import type { IRconGateway } from '@/domain/repositories/i-rcon-gateway.ts';
import type { ISshGateway } from '@/domain/repositories/i-ssh-gateway.ts';
import type { SshConnectionConfig, PlayerInfo } from '@/domain/entities/value-objects.ts';

// ── RconService ──

export class RconService {
  private tunnel: { close: () => void } | null = null;

  constructor(
    private readonly rcon: IRconGateway,
    private readonly ssh: ISshGateway,
  ) {}

  /**
   * Establishes SSH tunnel then connects RCON over it.
   * Tunnel forwards a random local port → 127.0.0.1:27015 on the remote VM.
   */
  async connect(
    conn: SshConnectionConfig,
    rconPassword: string,
  ): Promise<void> {
    // Pick a random local port in ephemeral range
    const localPort = 30000 + Math.floor(Math.random() * 30000);

    // 1. SSH tunnel first
    this.tunnel = await this.ssh.createTunnel(
      conn,
      localPort,
      '127.0.0.1',
      27015,
    );

    // 2. RCON connect over the tunnel
    await this.rcon.connect('127.0.0.1', localPort, rconPassword);
  }

  /**
   * Send 'players' command and parse the response into PlayerInfo[].
   *
   * Expected response format:
   *   Players connected (3):
   *   -zombie_slayer
   *   -survivor42
   *   -builder_bob
   */
  async players(): Promise<readonly PlayerInfo[]> {
    const response = await this.rcon.sendCommand('players');
    return parsePlayers(response.body);
  }

  /** Kick a player by username */
  async kick(username: string): Promise<void> {
    await this.rcon.sendCommand(`kickuser "${username}"`);
  }

  /** Ban a player by username */
  async ban(username: string): Promise<void> {
    await this.rcon.sendCommand(`banuser "${username}"`);
  }

  /** Broadcast a message to all connected players */
  async broadcast(message: string): Promise<void> {
    if (!message.trim()) {
      throw new Error('Broadcast message cannot be empty');
    }
    await this.rcon.sendCommand(`servermsg "${message}"`);
  }

  /** Force a world save */
  async save(): Promise<void> {
    await this.rcon.sendCommand('save');
  }

  /** Graceful quit — shuts down the server process */
  async quit(): Promise<void> {
    await this.rcon.sendCommand('quit');
  }

  /** Disconnect RCON then close the SSH tunnel */
  async disconnect(): Promise<void> {
    await this.rcon.disconnect();
    if (this.tunnel) {
      this.tunnel.close();
      this.tunnel = null;
    }
  }
}

// ── Pure function: parse RCON 'players' response ──

export function parsePlayers(body: string): readonly PlayerInfo[] {
  const lines = body.split('\n');
  const players: PlayerInfo[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Player lines start with '-'
    if (trimmed.startsWith('-')) {
      const username = trimmed.slice(1).trim();
      if (username.length > 0) {
        players.push({ username });
      }
    }
  }

  return players;
}
