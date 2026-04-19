import type { GameBranch } from '@/domain/entities/enums.ts';

// ── Docker Compose Template Generator ──

/**
 * Generates a docker-compose.yml string for a Project Zomboid dedicated server.
 *
 * Uses the `danixu/project-zomboid-server-docker` image with configurable
 * environment variables, UDP game ports, and persistent volume mounts.
 */
export function generateDockerCompose(vars: {
  serverName: string;
  serverMemory: string;
  rconPassword: string;
  gameBranch: GameBranch;
}): string {
  return `services:
  zomboid:
    image: danixu/project-zomboid-server-docker:latest
    container_name: zomboid-server
    restart: unless-stopped
    environment:
      - SERVER_NAME=${vars.serverName}
      - SERVER_MEMORY=${vars.serverMemory}
      - RCONPASSWORD=${vars.rconPassword}
      - RCONPORT=27015
      - GAME_BRANCH=${vars.gameBranch}
    ports:
      - "16261:16261/udp"
      - "16262:16262/udp"
    volumes:
      - /opt/zomboid/data:/home/steam/ZomboidDedicatedServer
      - /opt/zomboid/config:/home/steam/Zomboid
`;
}
