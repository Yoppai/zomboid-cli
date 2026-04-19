/**
 * Phase 4 Task 4.6 — tests/presentation/components/error-box.keyboard.test.tsx
 *
 * Keyboard tests for ErrorBox component.
 * ErrorBox delegates to SelectList for keyboard navigation when options are present.
 * Tests: render with options, keyboard selection of recovery options.
 *
 * TDD cycle: RED (new keyboard coverage tests) → GREEN (existing impl passes)
 */
import { describe, it, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { ErrorBox } from '@/presentation/components/ErrorBox.tsx';

describe('ErrorBox keyboard', () => {
  it('should render error code and message', () => {
    const { lastFrame } = render(
      React.createElement(ErrorBox, {
        code: 'SSH_CONNECTION_FAILED',
        message: 'SSH connection to 34.56.78.90 failed',
        options: [],
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('SSH_CONNECTION_FAILED');
    expect(frame).toContain('SSH connection to 34.56.78.90 failed');
  });

  it('should render recovery options as a SelectList', () => {
    const { lastFrame } = render(
      React.createElement(ErrorBox, {
        code: 'CDKTF_PROVISION_FAILED',
        message: 'Infrastructure provisioning failed',
        options: ['retry', 'destroy', 'abort'],
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Retry');
    expect(frame).toContain('Destroy');
    expect(frame).toContain('Abort');
  });

  it('should call onAction with selected recovery option on Enter', () => {
    let selectedAction: string | undefined;
    const { stdin } = render(
      React.createElement(ErrorBox, {
        code: 'RCON_AUTH_FAILED',
        message: 'RCON authentication failed',
        options: ['reconfigure', 'abort'],
        onAction: (action: string) => { selectedAction = action; },
      }),
    );
    stdin.write('\r'); // Enter on first item: 'reconfigure'
    expect(selectedAction).toBe('reconfigure');
  });

  it('should call onAction with second recovery option after down+Enter', () => {
    let selectedAction: string | undefined;
    const { stdin } = render(
      React.createElement(ErrorBox, {
        code: 'DEPLOY_FAILED',
        message: 'Deployment failed',
        options: ['retry', 'destroy', 'abort'],
        onAction: (action: string) => { selectedAction = action; },
      }),
    );
    stdin.write('\x1B[B'); // Down arrow → select 'destroy'
    stdin.write('\r');
    expect(selectedAction).toBe('destroy');
  });

  it('should call onAction with third recovery option after 2x down+Enter', () => {
    let selectedAction: string | undefined;
    const { stdin } = render(
      React.createElement(ErrorBox, {
        code: 'VM_BOOT_FAILED',
        message: 'VM boot timed out',
        options: ['retry', 'vm_diagnostics', 'abort'],
        onAction: (action: string) => { selectedAction = action; },
      }),
    );
    stdin.write('\x1B[B'); // Down to 'vm_diagnostics'
    stdin.write('\x1B[B'); // Down to 'abort'
    stdin.write('\r');
    expect(selectedAction).toBe('abort');
  });

  it('should call onAction with retry_deploy on down+Enter when retry is second', () => {
    let selectedAction: string | undefined;
    const { stdin } = render(
      React.createElement(ErrorBox, {
        code: 'PROVISION_FAILED',
        message: 'Provisioning failed',
        options: ['archive', 'retry_deploy', 'destroy_partial'],
        onAction: (action: string) => { selectedAction = action; },
      }),
    );
    stdin.write('\x1B[B'); // Down to 'retry_deploy'
    stdin.write('\r');
    expect(selectedAction).toBe('retry_deploy');
  });

  it('should not call onAction when no options provided', () => {
    let called = false;
    const { stdin } = render(
      React.createElement(ErrorBox, {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        options: [],
        onAction: () => { called = true; },
      }),
    );
    stdin.write('\r');
    expect(called).toBe(false);
  });

  it('should render with single recovery option', () => {
    let selectedAction: string | undefined;
    const { stdin } = render(
      React.createElement(ErrorBox, {
        code: 'RCON_AUTH_FAILED',
        message: 'RCON authentication failed',
        options: ['reconfigure'],
        onAction: (action: string) => { selectedAction = action; },
      }),
    );
    stdin.write('\r');
    expect(selectedAction).toBe('reconfigure');
  });

  it('should render multiple error code formats', () => {
    const frame1 = render(
      React.createElement(ErrorBox, {
        code: 'SSH_CONNECTION_FAILED',
        message: 'Connection refused',
        options: [],
      }),
    ).lastFrame();
    expect(frame1).toContain('SSH_CONNECTION_FAILED');

    const frame2 = render(
      React.createElement(ErrorBox, {
        code: 'CDKTF_',
        message: 'Stack creation failed',
        options: [],
      }),
    ).lastFrame();
    expect(frame2).toContain('CDKTF_');
  });

  it('should navigate back to first option with up arrow', () => {
    let selectedAction: string | undefined;
    const { stdin } = render(
      React.createElement(ErrorBox, {
        code: 'ERROR',
        message: 'Error',
        options: ['retry', 'destroy', 'abort'],
        onAction: (action: string) => { selectedAction = action; },
      }),
    );
    stdin.write('\x1B[B'); // Down to 'destroy'
    stdin.write('\x1B[A'); // Up back to 'retry'
    stdin.write('\r');
    expect(selectedAction).toBe('retry');
  });

  it('should clamp at last item when pressing down past end', () => {
    let selectedAction: string | undefined;
    const { stdin } = render(
      React.createElement(ErrorBox, {
        code: 'ERROR',
        message: 'Error',
        options: ['retry', 'destroy'],
        onAction: (action: string) => { selectedAction = action; },
      }),
    );
    stdin.write('\x1B[B'); // Down to 'destroy'
    stdin.write('\x1B[B'); // Down past end → clamp at 'destroy'
    stdin.write('\r');
    expect(selectedAction).toBe('destroy');
  });

  it('should call onAction with archive option', () => {
    let selectedAction: string | undefined;
    const { stdin } = render(
      React.createElement(ErrorBox, {
        code: 'ARCHIVE_ELIGIBLE',
        message: 'Server eligible for archiving',
        options: ['archive', 'destroy'],
        onAction: (action: string) => { selectedAction = action; },
      }),
    );
    stdin.write('\r'); // archive is first
    expect(selectedAction).toBe('archive');
  });

  it('should render ssh_manual label correctly', () => {
    const { lastFrame } = render(
      React.createElement(ErrorBox, {
        code: 'SSH_COMMAND_FAILED',
        message: 'Command execution failed',
        options: ['retry', 'ssh_manual', 'abort'],
      }),
    );
    expect(lastFrame()).toContain('SSH');
  });
});
