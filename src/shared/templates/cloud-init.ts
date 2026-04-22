// ── Cloud-Init Script Generator ──

/**
 * Generates a cloud-init bash script that bootstraps a Project Zomboid
 * game server on a fresh Ubuntu 22.04 VM.
 *
 * The script installs Docker Engine + Compose plugin, creates required
 * directories, writes the docker-compose.yml, and starts the container.
 */
export function generateCloudInit(vars: {
  dockerComposeContent: string;
}): string {
  return `#!/bin/bash
set -euo pipefail

# Install Docker Engine
curl -fsSL https://get.docker.com | sh

# Install Docker Compose Plugin
apt-get update && apt-get install -y docker-compose-plugin

# Create app directories
mkdir -p /opt/zomboid/{data,config}

# Write docker-compose.yml
cat > /opt/zomboid/docker-compose.yml << 'DOCKERCOMPOSE'
${vars.dockerComposeContent}
DOCKERCOMPOSE

# Start the server
cd /opt/zomboid && docker compose up -d
`;
}
