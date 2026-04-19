import { describe, it, expect } from 'bun:test';
import {
  createServerId,
  createTaskId,
  type Provider,
  type ServerStatus,
  type GameBranch,
  type TaskType,
  type ServerId,
  type TaskId,
} from '../../../src/domain/entities/enums.ts';

describe('Domain Enums', () => {
  describe('Provider type', () => {
    it('should accept valid provider values', () => {
      const providers: Provider[] = ['gcp', 'aws', 'azure'];
      expect(providers).toHaveLength(3);
      expect(providers).toContain('gcp');
      expect(providers).toContain('aws');
      expect(providers).toContain('azure');
    });
  });

  describe('ServerStatus type', () => {
    it('should accept all 5 valid status values', () => {
      const statuses: ServerStatus[] = [
        'provisioning',
        'running',
        'stopped',
        'failed',
        'archived',
      ];
      expect(statuses).toHaveLength(5);
      expect(statuses).toContain('provisioning');
      expect(statuses).toContain('running');
      expect(statuses).toContain('stopped');
      expect(statuses).toContain('failed');
      expect(statuses).toContain('archived');
    });
  });

  describe('GameBranch type', () => {
    it('should accept all 3 valid branch values', () => {
      const branches: GameBranch[] = ['stable', 'unstable', 'outdatedunstable'];
      expect(branches).toHaveLength(3);
      expect(branches).toContain('stable');
      expect(branches).toContain('unstable');
      expect(branches).toContain('outdatedunstable');
    });
  });

  describe('TaskType type', () => {
    it('should accept all 3 valid task types', () => {
      const types: TaskType[] = ['auto_restart', 'auto_backup', 'broadcast'];
      expect(types).toHaveLength(3);
      expect(types).toContain('auto_restart');
      expect(types).toContain('auto_backup');
      expect(types).toContain('broadcast');
    });
  });
});

describe('Branded Types', () => {
  describe('createServerId', () => {
    it('should create a ServerId from a string', () => {
      const id = createServerId('abc-123');
      expect(String(id)).toBe('abc-123');
    });

    it('should create different ServerIds for different strings', () => {
      const id1 = createServerId('server-1');
      const id2 = createServerId('server-2');
      expect(String(id1)).not.toBe(String(id2));
      expect(String(id1)).toBe('server-1');
      expect(String(id2)).toBe('server-2');
    });

    it('should be assignable to string', () => {
      const id: ServerId = createServerId('test-uuid');
      const str: string = id;
      expect(str).toBe('test-uuid');
    });
  });

  describe('createTaskId', () => {
    it('should create a TaskId from a string', () => {
      const id = createTaskId('task-456');
      expect(String(id)).toBe('task-456');
    });

    it('should create different TaskIds for different strings', () => {
      const id1 = createTaskId('task-a');
      const id2 = createTaskId('task-b');
      expect(String(id1)).not.toBe(String(id2));
      expect(String(id1)).toBe('task-a');
      expect(String(id2)).toBe('task-b');
    });

    it('should be assignable to string', () => {
      const id: TaskId = createTaskId('task-xyz');
      const str: string = id;
      expect(str).toBe('task-xyz');
    });
  });
});
