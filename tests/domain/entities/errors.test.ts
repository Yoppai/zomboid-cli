import { describe, it, expect } from 'bun:test';
import {
  DomainError,
  SshConnectionError,
  SshCommandError,
  CdktfProvisionError,
  CdktfDestroyError,
  RconAuthError,
  RconConnectionError,
  SftpTransferError,
  DatabaseError,
  VmBootTimeoutError,
  CloudInitTimeoutError,
  type RecoveryOption,
} from '../../../src/domain/entities/errors.ts';

describe('DomainError base class', () => {
  it('should be an instance of Error', () => {
    const error = new SshConnectionError('1.2.3.4');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
  });

  it('should set name to the constructor name', () => {
    const error = new SshConnectionError('1.2.3.4');
    expect(error.name).toBe('SshConnectionError');
  });

  it('should support cause chaining', () => {
    const cause = new Error('underlying network error');
    const error = new SshConnectionError('1.2.3.4', cause);
    expect(error.cause).toBe(cause);
    expect(error.cause?.message).toBe('underlying network error');
  });
});

describe('SshConnectionError', () => {
  it('should have correct code', () => {
    const error = new SshConnectionError('10.0.0.1');
    expect(error.code).toBe('SSH_CONNECTION_FAILED');
  });

  it('should include host in message', () => {
    const error = new SshConnectionError('34.56.78.90');
    expect(error.message).toContain('34.56.78.90');
  });

  it('should have recovery options: retry, ssh_manual, abort', () => {
    const error = new SshConnectionError('1.2.3.4');
    expect(error.recoveryOptions).toEqual(['retry', 'ssh_manual', 'abort']);
  });
});

describe('SshCommandError', () => {
  it('should have correct code', () => {
    const error = new SshCommandError('docker ps', 127, 'command not found');
    expect(error.code).toBe('SSH_COMMAND_FAILED');
  });

  it('should include command, exit code and stderr in message', () => {
    const error = new SshCommandError('apt-get install', 1, 'permission denied');
    expect(error.message).toContain('apt-get install');
    expect(error.message).toContain('1');
    expect(error.message).toContain('permission denied');
  });

  it('should have recovery options: retry, ssh_manual', () => {
    const error = new SshCommandError('ls', 1, 'err');
    expect(error.recoveryOptions).toEqual(['retry', 'ssh_manual']);
  });
});

describe('CdktfProvisionError', () => {
  it('should have correct code', () => {
    const error = new CdktfProvisionError();
    expect(error.code).toBe('CDKTF_PROVISION_FAILED');
  });

  it('should have recovery options: retry, destroy, abort', () => {
    const error = new CdktfProvisionError();
    expect(error.recoveryOptions).toEqual(['retry', 'destroy', 'abort']);
  });

  it('should support cause chaining', () => {
    const cause = new Error('terraform state lock');
    const error = new CdktfProvisionError(cause);
    expect(error.cause).toBe(cause);
  });

  it('should have descriptive message', () => {
    const error = new CdktfProvisionError();
    expect(error.message).toBe('Infrastructure provisioning failed');
  });
});

describe('CdktfDestroyError', () => {
  it('should have correct code', () => {
    const error = new CdktfDestroyError();
    expect(error.code).toBe('CDKTF_DESTROY_FAILED');
  });

  it('should have recovery options: retry, ssh_manual', () => {
    const error = new CdktfDestroyError();
    expect(error.recoveryOptions).toEqual(['retry', 'ssh_manual']);
  });

  it('should support cause chaining', () => {
    const cause = new Error('API quota exceeded');
    const error = new CdktfDestroyError(cause);
    expect(error.cause).toBe(cause);
  });
});

describe('RconAuthError', () => {
  it('should have correct code', () => {
    const error = new RconAuthError();
    expect(error.code).toBe('RCON_AUTH_FAILED');
  });

  it('should have recovery options: reconfigure', () => {
    const error = new RconAuthError();
    expect(error.recoveryOptions).toEqual(['reconfigure']);
  });

  it('should have descriptive message about password mismatch', () => {
    const error = new RconAuthError();
    expect(error.message).toContain('password');
  });
});

describe('RconConnectionError', () => {
  it('should have correct code', () => {
    const error = new RconConnectionError();
    expect(error.code).toBe('RCON_CONNECTION_FAILED');
  });

  it('should have recovery options: retry', () => {
    const error = new RconConnectionError();
    expect(error.recoveryOptions).toEqual(['retry']);
  });

  it('should support cause chaining', () => {
    const cause = new Error('ECONNREFUSED');
    const error = new RconConnectionError(cause);
    expect(error.cause).toBe(cause);
  });
});

describe('SftpTransferError', () => {
  it('should have correct code', () => {
    const error = new SftpTransferError('upload', '/tmp/backup.tar.gz');
    expect(error.code).toBe('SFTP_TRANSFER_FAILED');
  });

  it('should include operation and path in message', () => {
    const error = new SftpTransferError('download', '/opt/zomboid/backup.tar.gz');
    expect(error.message).toContain('download');
    expect(error.message).toContain('/opt/zomboid/backup.tar.gz');
  });

  it('should have recovery options: retry', () => {
    const error = new SftpTransferError('upload', '/path');
    expect(error.recoveryOptions).toEqual(['retry']);
  });

  it('should differentiate upload and download operations', () => {
    const upload = new SftpTransferError('upload', '/file');
    const download = new SftpTransferError('download', '/file');
    expect(upload.message).toContain('upload');
    expect(download.message).toContain('download');
  });
});

describe('DatabaseError', () => {
  it('should have correct code', () => {
    const error = new DatabaseError('INSERT');
    expect(error.code).toBe('DATABASE_ERROR');
  });

  it('should include operation in message', () => {
    const error = new DatabaseError('migration');
    expect(error.message).toContain('migration');
  });

  it('should have recovery options: abort', () => {
    const error = new DatabaseError('query');
    expect(error.recoveryOptions).toEqual(['abort']);
  });
});

describe('VmBootTimeoutError', () => {
  it('should have correct code', () => {
    const error = new VmBootTimeoutError('srv-001');
    expect(error.code).toBe('VM_BOOT_TIMEOUT');
  });

  it('should include serverId in message', () => {
    const error = new VmBootTimeoutError('srv-xyz');
    expect(error.message).toContain('srv-xyz');
  });

  it('should have recovery options: retry, show_logs, destroy', () => {
    const error = new VmBootTimeoutError('srv-001');
    expect(error.recoveryOptions).toEqual(['retry', 'show_logs', 'destroy']);
  });
});

describe('CloudInitTimeoutError', () => {
  it('should have correct code', () => {
    const error = new CloudInitTimeoutError('srv-002');
    expect(error.code).toBe('CLOUD_INIT_TIMEOUT');
  });

  it('should include serverId in message', () => {
    const error = new CloudInitTimeoutError('srv-abc');
    expect(error.message).toContain('srv-abc');
  });

  it('should have recovery options: retry, show_logs, ssh_manual, destroy', () => {
    const error = new CloudInitTimeoutError('srv-002');
    expect(error.recoveryOptions).toEqual(['retry', 'show_logs', 'ssh_manual', 'destroy']);
  });
});

describe('Error hierarchy — all errors extend DomainError', () => {
  const errors = [
    new SshConnectionError('host'),
    new SshCommandError('cmd', 1, 'err'),
    new CdktfProvisionError(),
    new CdktfDestroyError(),
    new RconAuthError(),
    new RconConnectionError(),
    new SftpTransferError('upload', '/path'),
    new DatabaseError('op'),
    new VmBootTimeoutError('id'),
    new CloudInitTimeoutError('id'),
  ];

  for (const error of errors) {
    it(`${error.constructor.name} should be instanceof DomainError`, () => {
      expect(error).toBeInstanceOf(DomainError);
    });

    it(`${error.constructor.name} should be instanceof Error`, () => {
      expect(error).toBeInstanceOf(Error);
    });

    it(`${error.constructor.name} should have a non-empty code`, () => {
      expect(error.code.length).toBeGreaterThan(0);
    });

    it(`${error.constructor.name} should have a non-empty message`, () => {
      expect(error.message.length).toBeGreaterThan(0);
    });

    it(`${error.constructor.name} should have recovery options array`, () => {
      expect(Array.isArray(error.recoveryOptions)).toBe(true);
      expect(error.recoveryOptions.length).toBeGreaterThan(0);
    });
  }
});

describe('SSH escape hatch — ssh_manual present in infra errors', () => {
  it('SshConnectionError includes ssh_manual', () => {
    expect(new SshConnectionError('h').recoveryOptions).toContain('ssh_manual');
  });

  it('SshCommandError includes ssh_manual', () => {
    expect(new SshCommandError('c', 1, 'e').recoveryOptions).toContain('ssh_manual');
  });

  it('CdktfDestroyError includes ssh_manual', () => {
    expect(new CdktfDestroyError().recoveryOptions).toContain('ssh_manual');
  });

  it('CloudInitTimeoutError includes ssh_manual', () => {
    expect(new CloudInitTimeoutError('s').recoveryOptions).toContain('ssh_manual');
  });
});
