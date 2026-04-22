// ── Recovery Options ──

export type RecoveryOption =
  | 'retry'
  | 'destroy'
  | 'ssh_manual'
  | 'abort'
  | 'reconfigure'
  | 'show_logs';

// ── Base Error ──

export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly recoveryOptions: readonly RecoveryOption[];
  override readonly cause?: Error;

  constructor(
    message: string,
    options?: { cause?: Error; recovery?: RecoveryOption[] },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.cause = options?.cause;
    this.recoveryOptions = options?.recovery ?? [];
  }
}

// ── Infrastructure Errors ──

export class SshConnectionError extends DomainError {
  readonly code = 'SSH_CONNECTION_FAILED' as const;
  constructor(host: string, cause?: Error) {
    super(`SSH connection to ${host} failed`, {
      cause,
      recovery: ['retry', 'ssh_manual', 'abort'],
    });
  }
}

export class SshCommandError extends DomainError {
  readonly code = 'SSH_COMMAND_FAILED' as const;
  constructor(command: string, exitCode: number, stderr: string) {
    super(
      `Command '${command}' exited with code ${exitCode}: ${stderr}`,
      { recovery: ['retry', 'ssh_manual'] },
    );
  }
}

export class CdktfProvisionError extends DomainError {
  readonly code = 'CDKTF_PROVISION_FAILED' as const;
  constructor(cause?: Error) {
    super('Infrastructure provisioning failed', {
      cause,
      recovery: ['retry', 'destroy', 'abort'],
    });
  }
}

export class CdktfDestroyError extends DomainError {
  readonly code = 'CDKTF_DESTROY_FAILED' as const;
  constructor(cause?: Error) {
    super('Infrastructure destruction failed', {
      cause,
      recovery: ['retry', 'ssh_manual'],
    });
  }
}

export class RconAuthError extends DomainError {
  readonly code = 'RCON_AUTH_FAILED' as const;
  constructor() {
    super('RCON authentication failed — password mismatch', {
      recovery: ['reconfigure'],
    });
  }
}

export class RconConnectionError extends DomainError {
  readonly code = 'RCON_CONNECTION_FAILED' as const;
  constructor(cause?: Error) {
    super('RCON connection lost', {
      cause,
      recovery: ['retry'],
    });
  }
}

export class SftpTransferError extends DomainError {
  readonly code = 'SFTP_TRANSFER_FAILED' as const;
  constructor(operation: 'upload' | 'download', path: string, cause?: Error) {
    super(`SFTP ${operation} failed for ${path}`, {
      cause,
      recovery: ['retry'],
    });
  }
}

export class DatabaseError extends DomainError {
  readonly code = 'DATABASE_ERROR' as const;
  constructor(operation: string, cause?: Error) {
    super(`Database ${operation} failed`, {
      cause,
      recovery: ['abort'],
    });
  }
}

export class VmBootTimeoutError extends DomainError {
  readonly code = 'VM_BOOT_TIMEOUT' as const;
  constructor(serverId: string) {
    super(
      `VM for server ${serverId} did not reach RUNNING within timeout`,
      { recovery: ['retry', 'show_logs', 'destroy'] },
    );
  }
}

export class CloudInitTimeoutError extends DomainError {
  readonly code = 'CLOUD_INIT_TIMEOUT' as const;
  constructor(serverId: string) {
    super(
      `cloud-init did not complete within timeout for server ${serverId}`,
      { recovery: ['retry', 'show_logs', 'ssh_manual', 'destroy'] },
    );
  }
}
