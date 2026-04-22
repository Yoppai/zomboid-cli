import { App, TerraformStack, GcsBackend } from 'cdktf';
import { Construct } from 'constructs';
import { GoogleProvider } from '@cdktf/provider-google/lib/provider';
import { ComputeInstance } from '@cdktf/provider-google/lib/compute-instance';
import { ComputeAddress } from '@cdktf/provider-google/lib/compute-address';
import { ComputeFirewall } from '@cdktf/provider-google/lib/compute-firewall';
import type { ServerId } from '@/shared/infra/entities/enums.ts';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// ── Stack Config ──

export interface ServerStackConfig {
  readonly serverId: ServerId;
  readonly projectId: string;
  readonly region: string;
  readonly zone: string;
  readonly machineType: string;
  readonly sshPublicKey: string;
  readonly cloudInitScript: string;
  readonly tfStateBucket: string;
}

// ── CDKTF Stack ──

/**
 * Defines the Terraform stack for a single Zomboid game server on GCP.
 *
 * Resources:
 * - google_compute_address (static IP)
 * - google_compute_firewall (UDP 16261-16262 ingress, NO RCON)
 * - google_compute_instance (Ubuntu 22.04 VM with cloud-init)
 *
 * State backend: GCS bucket with per-server prefix.
 */
export class ZomboidServerStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: ServerStackConfig) {
    super(scope, id);

    // ── Backend: GCS remote state ──
    new GcsBackend(this, {
      bucket: config.tfStateBucket,
      prefix: `zomboid-cli/${config.serverId}`,
    });

    // ── Provider ──
    new GoogleProvider(this, 'google', {
      project: config.projectId,
      region: config.region,
    });

    // ── Static IP ──
    const staticIp = new ComputeAddress(this, 'static-ip', {
      name: `zomboid-ip-${config.serverId}`,
      region: config.region,
    });

    // ── Firewall: Allow UDP game ports, DENY RCON (no rule = denied by default) ──
    new ComputeFirewall(this, 'game-ports', {
      name: `zomboid-fw-${config.serverId}`,
      network: 'default',
      allow: [
        {
          protocol: 'udp',
          ports: ['16261-16262'],
        },
      ],
      sourceRanges: ['0.0.0.0/0'],
      targetTags: [`zomboid-${config.serverId}`],
    });

    // ── Firewall: Allow SSH for management ──
    new ComputeFirewall(this, 'ssh-access', {
      name: `zomboid-ssh-${config.serverId}`,
      network: 'default',
      allow: [
        {
          protocol: 'tcp',
          ports: ['22'],
        },
      ],
      sourceRanges: ['0.0.0.0/0'],
      targetTags: [`zomboid-${config.serverId}`],
    });

    // ── VM Instance ──
    new ComputeInstance(this, 'server', {
      name: `zomboid-${config.serverId}`,
      machineType: config.machineType,
      zone: config.zone,
      tags: [`zomboid-${config.serverId}`],

      bootDisk: {
        initializeParams: {
          image: 'ubuntu-os-cloud/ubuntu-2204-lts',
          size: 50,
          type: 'pd-ssd',
        },
      },

      networkInterface: [
        {
          network: 'default',
          accessConfig: [
            {
              natIp: staticIp.address,
            },
          ],
        },
      ],

      metadata: {
        'ssh-keys': `zomboid:${config.sshPublicKey}`,
        'startup-script': config.cloudInitScript,
      },
    });
  }
}

// ── Synthesize Helper ──

/**
 * Synthesizes the ZomboidServerStack into Terraform JSON.
 * Returns the path to the cdktf.out directory containing the generated JSON.
 */
export function synthesizeStack(config: ServerStackConfig): string {
  const outDir = mkdtempSync(join(tmpdir(), 'zomboid-cdktf-'));

  const app = new App({ outdir: outDir });
  new ZomboidServerStack(app, `zomboid-${config.serverId}`, config);
  app.synth();

  return outDir;
}
