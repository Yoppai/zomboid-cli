import { describe, it, expect } from 'bun:test';
import type {
  MachineType,
  ServerConfig,
  RegionLatency,
  ContainerStats,
  RconResponse,
  BackupMeta,
  SshConnectionConfig,
  PlayerInfo,
} from '@/shared/infra/entities/value-objects.ts';
import type { ServerId } from '@/shared/infra/entities/enums.ts';
import { createServerId } from '@/shared/infra/entities/enums.ts';

describe('Value Objects', () => {
  describe('MachineType', () => {
    it('should hold all required fields as readonly', () => {
      const mt: MachineType = {
        id: 'e2-standard-2',
        label: 'Small Co-op (1-8)',
        totalRamGb: 8,
        serverMemoryGb: 6,
        maxPlayers: '1-8',
      };
      expect(mt.id).toBe('e2-standard-2');
      expect(mt.label).toBe('Small Co-op (1-8)');
      expect(mt.totalRamGb).toBe(8);
      expect(mt.serverMemoryGb).toBe(6);
      expect(mt.maxPlayers).toBe('1-8');
    });

    it('should hold different machine type data', () => {
      const mt: MachineType = {
        id: 'c2-standard-8',
        label: 'Massive (64+)',
        totalRamGb: 32,
        serverMemoryGb: 26,
        maxPlayers: '64+',
      };
      expect(mt.id).toBe('c2-standard-8');
      expect(mt.totalRamGb).toBe(32);
      expect(mt.serverMemoryGb).toBe(26);
    });
  });

  describe('ServerConfig', () => {
    it('should hold all required server configuration fields', () => {
      const config: ServerConfig = {
        name: 'test-server',
        provider: 'gcp',
        projectId: 'my-project',
        region: 'us-central1',
        zone: 'us-central1-a',
        machineType: {
          id: 'e2-standard-2',
          label: 'Small Co-op (1-8)',
          totalRamGb: 8,
          serverMemoryGb: 6,
          maxPlayers: '1-8',
        },
        gameBranch: 'stable',
        rconPassword: 'secret123',
        sshPublicKey: 'ssh-ed25519 AAAAC3...',
        sshPrivateKey: '-----BEGIN OPENSSH PRIVATE KEY-----...',
      };
      expect(config.name).toBe('test-server');
      expect(config.provider).toBe('gcp');
      expect(config.projectId).toBe('my-project');
      expect(config.region).toBe('us-central1');
      expect(config.zone).toBe('us-central1-a');
      expect(config.machineType.id).toBe('e2-standard-2');
      expect(config.gameBranch).toBe('stable');
      expect(config.rconPassword).toBe('secret123');
      expect(config.sshPublicKey).toBe('ssh-ed25519 AAAAC3...');
      expect(config.sshPrivateKey).toBe('-----BEGIN OPENSSH PRIVATE KEY-----...');
    });
  });

  describe('RegionLatency', () => {
    it('should hold region, zone and latency in ms', () => {
      const rl: RegionLatency = {
        region: 'us-central1',
        zone: 'us-central1-a',
        latencyMs: 45,
      };
      expect(rl.region).toBe('us-central1');
      expect(rl.zone).toBe('us-central1-a');
      expect(rl.latencyMs).toBe(45);
    });

    it('should handle Infinity latency for timed-out regions', () => {
      const rl: RegionLatency = {
        region: 'asia-east1',
        zone: 'asia-east1-a',
        latencyMs: Infinity,
      };
      expect(rl.latencyMs).toBe(Infinity);
    });
  });

  describe('ContainerStats', () => {
    it('should hold all container metrics', () => {
      const stats: ContainerStats = {
        cpuPercent: '12.50%',
        memUsage: '1.5GiB / 6GiB',
        memPercent: '25.00%',
        netIO: '1.2MB / 500KB',
        blockIO: '100MB / 50MB',
        pids: 42,
      };
      expect(stats.cpuPercent).toBe('12.50%');
      expect(stats.memUsage).toBe('1.5GiB / 6GiB');
      expect(stats.memPercent).toBe('25.00%');
      expect(stats.netIO).toBe('1.2MB / 500KB');
      expect(stats.blockIO).toBe('100MB / 50MB');
      expect(stats.pids).toBe(42);
    });
  });

  describe('RconResponse', () => {
    it('should hold request ID, body and type', () => {
      const resp: RconResponse = {
        requestId: 1,
        body: 'Players connected (3):...',
        type: 0,
      };
      expect(resp.requestId).toBe(1);
      expect(resp.body).toBe('Players connected (3):...');
      expect(resp.type).toBe(0);
    });

    it('should handle empty body response', () => {
      const resp: RconResponse = {
        requestId: 2,
        body: '',
        type: 0,
      };
      expect(resp.requestId).toBe(2);
      expect(resp.body).toBe('');
    });
  });

  describe('BackupMeta', () => {
    it('should hold backup metadata with ServerId', () => {
      const serverId: ServerId = createServerId('srv-001');
      const backup: BackupMeta = {
        serverId,
        filename: 'zomboid-backup-2026-04-15.tar.gz',
        localPath: '/home/user/.zomboid-cli/backups/my-server/zomboid-backup-2026-04-15.tar.gz',
        sizeBytes: 1048576,
        createdAt: '2026-04-15T10:30:00Z',
      };
      expect(String(backup.serverId)).toBe('srv-001');
      expect(backup.filename).toBe('zomboid-backup-2026-04-15.tar.gz');
      expect(backup.sizeBytes).toBe(1048576);
      expect(backup.createdAt).toBe('2026-04-15T10:30:00Z');
    });
  });

  describe('SshConnectionConfig', () => {
    it('should hold SSH connection parameters', () => {
      const conn: SshConnectionConfig = {
        host: '34.56.78.90',
        port: 22,
        username: 'root',
        privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----...',
      };
      expect(conn.host).toBe('34.56.78.90');
      expect(conn.port).toBe(22);
      expect(conn.username).toBe('root');
      expect(conn.privateKey).toBe('-----BEGIN OPENSSH PRIVATE KEY-----...');
    });

    it('should support non-standard SSH ports', () => {
      const conn: SshConnectionConfig = {
        host: '10.0.0.1',
        port: 2222,
        username: 'admin',
        privateKey: 'key-data',
      };
      expect(conn.port).toBe(2222);
    });
  });

  describe('PlayerInfo', () => {
    it('should hold username and optional steamId', () => {
      const player: PlayerInfo = {
        username: 'survivor42',
        steamId: '76561198012345678',
      };
      expect(player.username).toBe('survivor42');
      expect(player.steamId).toBe('76561198012345678');
    });

    it('should allow steamId to be undefined', () => {
      const player: PlayerInfo = {
        username: 'anonymous_player',
      };
      expect(player.username).toBe('anonymous_player');
      expect(player.steamId).toBeUndefined();
    });
  });
});

