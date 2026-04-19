import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { IRconGateway } from '@/domain/repositories/i-rcon-gateway.ts';
import type { ISshGateway, CommandResult } from '@/domain/repositories/i-ssh-gateway.ts';
import type { RconResponse, SshConnectionConfig, PlayerInfo } from '@/domain/entities/value-objects.ts';

// Production code that does NOT exist yet — guarantees RED
import { RconService } from '@/application/services/rcon-service.ts';

// ── Helpers ──

const TEST_CONN: SshConnectionConfig = {
  host: '34.120.5.1',
  port: 22,
  username: 'root',
  privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
};

const TEST_RCON_PASSWORD = 'supersecret123';

function rconResponse(body: string): RconResponse {
  return { requestId: 1, body, type: 0 };
}

function createMockRcon(overrides: Partial<IRconGateway> = {}): IRconGateway {
  return {
    connect: mock(async () => {}),
    sendCommand: mock(async () => rconResponse('')),
    disconnect: mock(async () => {}),
    isConnected: mock(() => false),
    ...overrides,
  };
}

function createMockSsh(overrides: Partial<ISshGateway> = {}): ISshGateway {
  return {
    exec: mock(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
    execStream: mock(async () => {}),
    createTunnel: mock(async () => ({ close: mock(() => {}) })),
    testConnection: mock(async () => true),
    disconnect: mock(async () => {}),
    disconnectAll: mock(async () => {}),
    ...overrides,
  };
}

// ── Tests ──

describe('RconService', () => {
  let rcon: IRconGateway;
  let ssh: ISshGateway;
  let svc: RconService;

  beforeEach(() => {
    rcon = createMockRcon();
    ssh = createMockSsh();
    svc = new RconService(rcon, ssh);
  });

  // ── connect ──

  describe('connect', () => {
    it('should create SSH tunnel BEFORE connecting RCON', async () => {
      const callOrder: string[] = [];

      ssh = createMockSsh({
        createTunnel: mock(async () => {
          callOrder.push('tunnel');
          return { close: mock(() => {}) };
        }),
      });
      rcon = createMockRcon({
        connect: mock(async () => {
          callOrder.push('rcon');
        }),
      });
      svc = new RconService(rcon, ssh);

      await svc.connect(TEST_CONN, TEST_RCON_PASSWORD);

      expect(callOrder).toEqual(['tunnel', 'rcon']);
      expect(ssh.createTunnel).toHaveBeenCalledTimes(1);
      expect(rcon.connect).toHaveBeenCalledTimes(1);
    });

    it('should tunnel to 127.0.0.1:27015 on the remote side', async () => {
      let capturedRemoteHost = '';
      let capturedRemotePort = 0;

      ssh = createMockSsh({
        createTunnel: mock(async (_conn, _localPort, remoteHost, remotePort) => {
          capturedRemoteHost = remoteHost;
          capturedRemotePort = remotePort;
          return { close: mock(() => {}) };
        }),
      });
      svc = new RconService(rcon, ssh);

      await svc.connect(TEST_CONN, TEST_RCON_PASSWORD);

      expect(capturedRemoteHost).toBe('127.0.0.1');
      expect(capturedRemotePort).toBe(27015);
    });

    it('should connect RCON to localhost with the tunnel local port', async () => {
      let capturedHost = '';
      let capturedPassword = '';

      rcon = createMockRcon({
        connect: mock(async (host, _port, password) => {
          capturedHost = host;
          capturedPassword = password;
        }),
      });
      svc = new RconService(rcon, ssh);

      await svc.connect(TEST_CONN, TEST_RCON_PASSWORD);

      expect(capturedHost).toBe('127.0.0.1');
      expect(capturedPassword).toBe(TEST_RCON_PASSWORD);
    });
  });

  // ── players ──

  describe('players', () => {
    it('should parse player list with 3 players', async () => {
      rcon = createMockRcon({
        sendCommand: mock(async () =>
          rconResponse(
            'Players connected (3):\n-zombie_slayer\n-survivor42\n-builder_bob',
          ),
        ),
      });
      svc = new RconService(rcon, ssh);

      const players = await svc.players();

      expect(players).toHaveLength(3);
      expect(players[0]!.username).toBe('zombie_slayer');
      expect(players[1]!.username).toBe('survivor42');
      expect(players[2]!.username).toBe('builder_bob');
    });

    it('should return empty array when no players are connected', async () => {
      rcon = createMockRcon({
        sendCommand: mock(async () =>
          rconResponse('Players connected (0):'),
        ),
      });
      svc = new RconService(rcon, ssh);

      const players = await svc.players();
      expect(players).toEqual([]);
    });

    it('should send the "players" command', async () => {
      rcon = createMockRcon({
        sendCommand: mock(async () => rconResponse('Players connected (0):')),
      });
      svc = new RconService(rcon, ssh);

      await svc.players();

      expect(rcon.sendCommand).toHaveBeenCalledWith('players');
    });

    it('should handle player names with spaces', async () => {
      rcon = createMockRcon({
        sendCommand: mock(async () =>
          rconResponse('Players connected (1):\n-john doe'),
        ),
      });
      svc = new RconService(rcon, ssh);

      const players = await svc.players();
      expect(players).toHaveLength(1);
      expect(players[0]!.username).toBe('john doe');
    });
  });

  // ── kick ──

  describe('kick', () => {
    it('should send kickuser command with quoted username', async () => {
      await svc.kick('zombie_slayer');

      expect(rcon.sendCommand).toHaveBeenCalledWith('kickuser "zombie_slayer"');
    });

    it('should handle usernames with spaces', async () => {
      await svc.kick('john doe');

      expect(rcon.sendCommand).toHaveBeenCalledWith('kickuser "john doe"');
    });
  });

  // ── ban ──

  describe('ban', () => {
    it('should send banuser command with quoted username', async () => {
      await svc.ban('griefer123');

      expect(rcon.sendCommand).toHaveBeenCalledWith('banuser "griefer123"');
    });
  });

  // ── broadcast ──

  describe('broadcast', () => {
    it('should send servermsg command with quoted message', async () => {
      await svc.broadcast('Server restarting in 5 minutes');

      expect(rcon.sendCommand).toHaveBeenCalledWith(
        'servermsg "Server restarting in 5 minutes"',
      );
    });

    it('should reject empty broadcast message', async () => {
      await expect(svc.broadcast('')).rejects.toThrow();
      expect(rcon.sendCommand).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only broadcast message', async () => {
      await expect(svc.broadcast('   ')).rejects.toThrow();
      expect(rcon.sendCommand).not.toHaveBeenCalled();
    });
  });

  // ── save ──

  describe('save', () => {
    it('should send "save" command', async () => {
      await svc.save();

      expect(rcon.sendCommand).toHaveBeenCalledWith('save');
    });
  });

  // ── quit ──

  describe('quit', () => {
    it('should send "quit" command', async () => {
      await svc.quit();

      expect(rcon.sendCommand).toHaveBeenCalledWith('quit');
    });
  });

  // ── disconnect ──

  describe('disconnect', () => {
    it('should disconnect RCON then close tunnel', async () => {
      const callOrder: string[] = [];
      const tunnelClose = mock(() => {
        callOrder.push('tunnel-close');
      });

      ssh = createMockSsh({
        createTunnel: mock(async () => ({ close: tunnelClose })),
      });
      rcon = createMockRcon({
        disconnect: mock(async () => {
          callOrder.push('rcon-disconnect');
        }),
      });
      svc = new RconService(rcon, ssh);

      // Must connect first to have a tunnel
      await svc.connect(TEST_CONN, TEST_RCON_PASSWORD);
      callOrder.length = 0; // Reset

      await svc.disconnect();

      expect(callOrder).toEqual(['rcon-disconnect', 'tunnel-close']);
    });

    it('should be safe to call disconnect without prior connect', async () => {
      // Should not throw
      await svc.disconnect();
      expect(rcon.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
