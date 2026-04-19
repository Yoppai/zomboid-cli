import { describe, it, expect } from 'bun:test';
import { generateCloudInit } from '@/infrastructure/cdktf/templates/cloud-init.ts';

describe('generateCloudInit', () => {
  const sampleCompose = `services:
  zomboid:
    image: danixu/project-zomboid-server-docker:latest
    container_name: zomboid-server
    restart: unless-stopped`;

  it('returns a string starting with bash shebang', () => {
    const result = generateCloudInit({ dockerComposeContent: sampleCompose });
    expect(result.startsWith('#!/bin/bash')).toBe(true);
  });

  it('sets strict bash error handling (set -euo pipefail)', () => {
    const result = generateCloudInit({ dockerComposeContent: sampleCompose });
    expect(result).toContain('set -euo pipefail');
  });

  it('installs Docker Engine via get.docker.com', () => {
    const result = generateCloudInit({ dockerComposeContent: sampleCompose });
    expect(result).toContain('https://get.docker.com');
  });

  it('installs docker-compose-plugin', () => {
    const result = generateCloudInit({ dockerComposeContent: sampleCompose });
    expect(result).toContain('docker-compose-plugin');
  });

  it('creates /opt/zomboid/data and /opt/zomboid/config directories', () => {
    const result = generateCloudInit({ dockerComposeContent: sampleCompose });
    expect(result).toContain('mkdir -p /opt/zomboid/{data,config}');
  });

  it('writes docker-compose.yml to /opt/zomboid/', () => {
    const result = generateCloudInit({ dockerComposeContent: sampleCompose });
    expect(result).toContain('/opt/zomboid/docker-compose.yml');
  });

  it('embeds the provided docker-compose content verbatim', () => {
    const result = generateCloudInit({ dockerComposeContent: sampleCompose });
    expect(result).toContain(sampleCompose);
  });

  it('runs docker compose up -d', () => {
    const result = generateCloudInit({ dockerComposeContent: sampleCompose });
    expect(result).toContain('docker compose up -d');
  });

  // TRIANGULATE: different compose content
  it('embeds different compose content correctly', () => {
    const customCompose = `services:
  zomboid:
    image: custom/image:v2
    environment:
      - SERVER_NAME=test-server`;
    const result = generateCloudInit({ dockerComposeContent: customCompose });
    expect(result).toContain('custom/image:v2');
    expect(result).toContain('SERVER_NAME=test-server');
  });

  it('uses heredoc delimiter to safely embed compose content', () => {
    const result = generateCloudInit({ dockerComposeContent: sampleCompose });
    // Should use a heredoc to write the file (cat > ... << 'DELIMITER')
    expect(result).toContain('DOCKERCOMPOSE');
  });

  it('changes to /opt/zomboid before running docker compose', () => {
    const result = generateCloudInit({ dockerComposeContent: sampleCompose });
    expect(result).toContain('cd /opt/zomboid');
  });
});
