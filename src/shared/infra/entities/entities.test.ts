import { describe, it, expect } from 'bun:test';
import type { ServerRecord } from '@/shared/infra/entities/server-record.ts';
import type { ScheduledTask } from '@/shared/infra/entities/scheduled-task.ts';
import type { Setting, SettingKey } from '@/shared/infra/entities/setting.ts';
import { isValidStatusTransition } from '@/shared/infra/entities/server-record.ts';
import { createServerId, createTaskId } from '@/shared/infra/entities/enums.ts';
import type { ServerStatus } from '@/shared/infra/entities/enums.ts';

describe('ServerRecord entity', () => {
  it('should hold all required fields', () => {
    const record: ServerRecord = {
      id: createServerId('srv-001'),
      name: 'my-server',
      provider: 'gcp',
      projectId: 'my-gcp-project',
      instanceType: 'e2-standard-2',
      instanceZone: 'us-central1-a',
      staticIp: '34.56.78.90',
      sshPrivateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
      rconPassword: 'rcon-secret',
      gameBranch: 'stable',
      status: 'provisioning',
      errorMessage: null,
      backupPath: null,
      createdAt: '2026-04-15T10:00:00Z',
      updatedAt: '2026-04-15T10:00:00Z',
    };
    expect(String(record.id)).toBe('srv-001');
    expect(record.name).toBe('my-server');
    expect(record.provider).toBe('gcp');
    expect(record.status).toBe('provisioning');
    expect(record.staticIp).toBe('34.56.78.90');
    expect(record.errorMessage).toBeNull();
    expect(record.backupPath).toBeNull();
  });

  it('should allow mutable status, errorMessage, backupPath, and updatedAt', () => {
    const record: ServerRecord = {
      id: createServerId('srv-002'),
      name: 'mutable-test',
      provider: 'gcp',
      projectId: 'proj',
      instanceType: 'n2-standard-4',
      instanceZone: 'europe-west1-b',
      staticIp: null,
      sshPrivateKey: 'key',
      rconPassword: 'pass',
      gameBranch: 'unstable',
      status: 'running',
      errorMessage: null,
      backupPath: null,
      createdAt: '2026-04-15T10:00:00Z',
      updatedAt: '2026-04-15T10:00:00Z',
    };
    record.status = 'stopped';
    record.errorMessage = 'something went wrong';
    record.updatedAt = '2026-04-15T11:00:00Z';
    expect(record.status).toBe('stopped');
    expect(record.errorMessage).toBe('something went wrong');
    expect(record.updatedAt).toBe('2026-04-15T11:00:00Z');
  });
});

describe('ScheduledTask entity', () => {
  it('should hold all required fields', () => {
    const task: ScheduledTask = {
      id: createTaskId('task-001'),
      serverId: createServerId('srv-001'),
      type: 'auto_restart',
      cronExpression: '0 4 * * *',
      payload: null,
      enabled: true,
      createdAt: '2026-04-15T10:00:00Z',
    };
    expect(String(task.id)).toBe('task-001');
    expect(String(task.serverId)).toBe('srv-001');
    expect(task.type).toBe('auto_restart');
    expect(task.cronExpression).toBe('0 4 * * *');
    expect(task.payload).toBeNull();
    expect(task.enabled).toBe(true);
  });

  it('should hold broadcast task with payload', () => {
    const task: ScheduledTask = {
      id: createTaskId('task-002'),
      serverId: createServerId('srv-001'),
      type: 'broadcast',
      cronExpression: '*/30 * * * *',
      payload: 'Server restart in 30 minutes!',
      enabled: true,
      createdAt: '2026-04-15T10:00:00Z',
    };
    expect(task.type).toBe('broadcast');
    expect(task.payload).toBe('Server restart in 30 minutes!');
  });

  it('should allow mutable enabled flag', () => {
    const task: ScheduledTask = {
      id: createTaskId('task-003'),
      serverId: createServerId('srv-001'),
      type: 'auto_backup',
      cronExpression: '0 3 * * *',
      payload: null,
      enabled: true,
      createdAt: '2026-04-15T10:00:00Z',
    };
    task.enabled = false;
    expect(task.enabled).toBe(false);
  });
});

describe('Setting entity', () => {
  it('should hold key-value pair', () => {
    const setting: Setting = { key: 'locale', value: 'en' };
    expect(setting.key).toBe('locale');
    expect(setting.value).toBe('en');
  });

  it('should accept all known setting keys via SettingKey type', () => {
    const keys: SettingKey[] = ['locale', 'backup_path', 'theme'];
    expect(keys).toHaveLength(3);
    expect(keys).toContain('locale');
    expect(keys).toContain('backup_path');
    expect(keys).toContain('theme');
  });

  it('should allow mutable value', () => {
    const setting: Setting = { key: 'locale', value: 'en' };
    setting.value = 'es';
    expect(setting.value).toBe('es');
  });
});

describe('isValidStatusTransition', () => {
  // ── Valid transitions ──
  const validTransitions: Array<[ServerStatus, ServerStatus]> = [
    // From provisioning
    ['provisioning', 'running'],
    ['provisioning', 'failed'],
    // From running
    ['running', 'stopped'],
    ['running', 'failed'],
    // From stopped
    ['stopped', 'running'],
    ['stopped', 'failed'],
    ['stopped', 'archived'],
    // From failed
    ['failed', 'provisioning'],
    ['failed', 'archived'],
  ];

  for (const [from, to] of validTransitions) {
    it(`should allow transition from '${from}' to '${to}'`, () => {
      expect(isValidStatusTransition(from, to)).toBe(true);
    });
  }

  // ── Invalid transitions ──
  const invalidTransitions: Array<[ServerStatus, ServerStatus]> = [
    // From archived (terminal — no transitions)
    ['archived', 'running'],
    ['archived', 'stopped'],
    ['archived', 'provisioning'],
    ['archived', 'failed'],
    ['archived', 'archived'],
    // From provisioning (can't go to stopped or archived directly)
    ['provisioning', 'stopped'],
    ['provisioning', 'archived'],
    ['provisioning', 'provisioning'],
    // From running (can't go to provisioning or archived directly)
    ['running', 'provisioning'],
    ['running', 'archived'],
    ['running', 'running'],
    // From stopped (can't go to provisioning)
    ['stopped', 'provisioning'],
    ['stopped', 'stopped'],
    // From failed (can't go to running/stopped directly)
    ['failed', 'running'],
    ['failed', 'stopped'],
    ['failed', 'failed'],
  ];

  for (const [from, to] of invalidTransitions) {
    it(`should reject transition from '${from}' to '${to}'`, () => {
      expect(isValidStatusTransition(from, to)).toBe(false);
    });
  }
});

