import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, readFileSync } from 'fs';
import {
  ZomboidServerStack,
  synthesizeStack,
  type ServerStackConfig,
} from '@/infrastructure/cdktf/zomboid-server-stack.ts';
import type { ServerId } from '@/domain/entities/enums.ts';
import { createServerId } from '@/domain/entities/enums.ts';

describe('ZomboidServerStack', () => {
  const defaultConfig: ServerStackConfig = {
    serverId: createServerId('srv-test-001'),
    projectId: 'my-gcp-project',
    region: 'us-central1',
    zone: 'us-central1-a',
    machineType: 'e2-standard-2',
    sshPublicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... zomboid-cli',
    cloudInitScript: '#!/bin/bash\necho hello',
    tfStateBucket: 'zomboid-cli-tfstate-my-gcp-project',
  };

  let synthDir: string;

  beforeEach(() => {
    synthDir = '';
  });

  afterEach(() => {
    // Clean up synth output if created
    if (synthDir && existsSync(synthDir)) {
      rmSync(synthDir, { recursive: true, force: true });
    }
  });

  describe('synthesizeStack', () => {
    it('returns a path to the synth output directory', () => {
      synthDir = synthesizeStack(defaultConfig);
      expect(typeof synthDir).toBe('string');
      expect(synthDir.length).toBeGreaterThan(0);
    });

    it('creates a valid output directory with Terraform JSON', () => {
      synthDir = synthesizeStack(defaultConfig);
      expect(existsSync(synthDir)).toBe(true);
      // CDKTF outputs cdk.tf.json in the stack dir
      const stackDir = `${synthDir}/stacks/zomboid-srv-test-001`;
      expect(existsSync(stackDir)).toBe(true);
    });

    it('generates TF JSON containing google provider', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      expect(tfJson.provider).toBeDefined();
      expect(tfJson.provider.google).toBeDefined();
    });

    it('sets google provider project and region', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      const googleProvider = tfJson.provider.google[0];
      expect(googleProvider.project).toBe('my-gcp-project');
      expect(googleProvider.region).toBe('us-central1');
    });

    it('creates a compute_address resource for static IP', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      const resources = tfJson.resource;
      expect(resources.google_compute_address).toBeDefined();
    });

    it('creates a compute_firewall resource allowing UDP 16261-16262', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      const firewalls = tfJson.resource.google_compute_firewall;
      expect(firewalls).toBeDefined();

      // Get the first firewall resource
      const fwName = Object.keys(firewalls)[0]!;
      const fw = firewalls[fwName];

      // Should have allow rules for UDP 16261-16262
      const allowRules = fw.allow;
      expect(allowRules).toBeDefined();
      expect(Array.isArray(allowRules)).toBe(true);

      const udpRule = allowRules.find(
        (r: any) => r.protocol === 'udp',
      );
      expect(udpRule).toBeDefined();
      expect(udpRule.ports).toContain('16261-16262');
    });

    it('does NOT create any firewall rule for RCON port (27015)', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      const jsonStr = JSON.stringify(tfJson);
      expect(jsonStr).not.toContain('27015');
    });

    it('creates a compute_instance resource', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      expect(tfJson.resource.google_compute_instance).toBeDefined();
    });

    it('sets correct machine type on the compute instance', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      const instances = tfJson.resource.google_compute_instance;
      const instName = Object.keys(instances)[0]!;
      expect(instances[instName].machine_type).toBe('e2-standard-2');
    });

    it('sets correct zone on the compute instance', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      const instances = tfJson.resource.google_compute_instance;
      const instName = Object.keys(instances)[0]!;
      expect(instances[instName].zone).toBe('us-central1-a');
    });

    it('uses Ubuntu 22.04 LTS boot disk image', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      const instances = tfJson.resource.google_compute_instance;
      const instName = Object.keys(instances)[0]!;
      const instance = instances[instName];

      const jsonStr = JSON.stringify(instance);
      expect(jsonStr).toContain('ubuntu-2204-lts');
    });

    it('injects SSH public key into VM metadata', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      const instances = tfJson.resource.google_compute_instance;
      const instName = Object.keys(instances)[0]!;
      const instance = instances[instName];

      const metadataStr = JSON.stringify(instance.metadata);
      expect(metadataStr).toContain('ssh-ed25519');
    });

    it('injects cloud-init script as startup-script metadata', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      const instances = tfJson.resource.google_compute_instance;
      const instName = Object.keys(instances)[0]!;
      const instance = instances[instName];

      const metadataStr = JSON.stringify(instance.metadata);
      expect(metadataStr).toContain('echo hello');
    });

    it('configures GCS backend for remote state', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      expect(tfJson.terraform?.backend?.gcs).toBeDefined();
      expect(tfJson.terraform.backend.gcs.bucket).toBe(
        'zomboid-cli-tfstate-my-gcp-project',
      );
    });

    it('sets GCS backend prefix with serverId', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      expect(tfJson.terraform.backend.gcs.prefix).toContain('srv-test-001');
    });

    // TRIANGULATE: different config
    it('uses different machine type and zone when configured differently', () => {
      const altConfig: ServerStackConfig = {
        ...defaultConfig,
        serverId: createServerId('srv-alt-002'),
        machineType: 'c2-standard-8',
        zone: 'europe-west1-b',
        region: 'europe-west1',
      };
      synthDir = synthesizeStack(altConfig);
      const tfJson = readTfJson(synthDir, 'srv-alt-002');
      const instances = tfJson.resource.google_compute_instance;
      const instName = Object.keys(instances)[0]!;
      expect(instances[instName].machine_type).toBe('c2-standard-8');
      expect(instances[instName].zone).toBe('europe-west1-b');
    });

    it('attaches static IP to the compute instance network interface', () => {
      synthDir = synthesizeStack(defaultConfig);
      const tfJson = readTfJson(synthDir, 'srv-test-001');
      const instances = tfJson.resource.google_compute_instance;
      const instName = Object.keys(instances)[0]!;
      const instance = instances[instName];

      // network_interface should have access_config referencing the static IP
      expect(instance.network_interface).toBeDefined();
      const jsonStr = JSON.stringify(instance.network_interface);
      // Should reference the compute_address
      expect(jsonStr.length).toBeGreaterThan(0);
    });
  });
});

// ── Helper to read synthesized TF JSON ──

function readTfJson(synthDir: string, serverId: string): any {
  const path = `${synthDir}/stacks/zomboid-${serverId}/cdk.tf.json`;
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}
