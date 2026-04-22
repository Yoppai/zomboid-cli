import { describe, it, expect } from 'bun:test';
import { generateDockerCompose } from '@/shared/templates/docker-compose.ts';
import type { GameBranch } from '@/shared/infra/entities/enums.ts';

describe('generateDockerCompose', () => {
  const defaultVars = {
    serverName: 'my-zomboid-server',
    serverMemory: '6g',
    rconPassword: 'secretpass123',
    gameBranch: 'stable' as GameBranch,
  };

  it('uses the correct Docker image', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result).toContain('danixu/project-zomboid-server-docker:latest');
  });

  it('sets container_name to zomboid-server', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result).toContain('container_name: zomboid-server');
  });

  it('sets restart policy to unless-stopped', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result).toContain('restart: unless-stopped');
  });

  it('includes SERVER_NAME environment variable', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result).toContain('SERVER_NAME=my-zomboid-server');
  });

  it('includes SERVER_MEMORY environment variable', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result).toContain('SERVER_MEMORY=6g');
  });

  it('includes RCONPASSWORD environment variable', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result).toContain('RCONPASSWORD=secretpass123');
  });

  it('includes RCONPORT=27015 environment variable', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result).toContain('RCONPORT=27015');
  });

  it('includes GAME_BRANCH environment variable', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result).toContain('GAME_BRANCH=stable');
  });

  it('publishes UDP ports 16261 and 16262', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result).toContain('16261:16261/udp');
    expect(result).toContain('16262:16262/udp');
  });

  it('mounts /opt/zomboid/data volume', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result).toContain('/opt/zomboid/data');
  });

  it('mounts /opt/zomboid/config volume', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result).toContain('/opt/zomboid/config');
  });

  it('starts with services: key (valid YAML root)', () => {
    const result = generateDockerCompose(defaultVars);
    expect(result.trimStart().startsWith('services:')).toBe(true);
  });

  // ── TRIANGULATE: different inputs ──

  it('uses unstable game branch when specified', () => {
    const result = generateDockerCompose({
      ...defaultVars,
      gameBranch: 'unstable',
    });
    expect(result).toContain('GAME_BRANCH=unstable');
  });

  it('uses different server name and memory', () => {
    const result = generateDockerCompose({
      serverName: 'mega-server',
      serverMemory: '26g',
      rconPassword: 'hunter2',
      gameBranch: 'outdatedunstable' as GameBranch,
    });
    expect(result).toContain('SERVER_NAME=mega-server');
    expect(result).toContain('SERVER_MEMORY=26g');
    expect(result).toContain('RCONPASSWORD=hunter2');
    expect(result).toContain('GAME_BRANCH=outdatedunstable');
  });

  it('always includes RCONPORT=27015 regardless of inputs', () => {
    const result = generateDockerCompose({
      serverName: 'test',
      serverMemory: '12g',
      rconPassword: 'pass',
      gameBranch: 'stable' as GameBranch,
    });
    expect(result).toContain('RCONPORT=27015');
  });
});
