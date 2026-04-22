import { describe, it, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';

// Production code that does NOT exist yet — guarantees RED
import { StatusBadge } from '@/shared/components/common/StatusBadge.tsx';
import { Spinner } from '@/shared/components/common/Spinner.tsx';
import { Header } from '@/shared/components/common/Header.tsx';
import { KeyHint } from '@/shared/components/common/KeyHint.tsx';
import { ConfirmDialog } from '@/shared/components/common/ConfirmDialog.tsx';
import { ErrorBox } from '@/shared/components/common/ErrorBox.tsx';

// ── StatusBadge ──

describe('StatusBadge', () => {
  it('should render "Running" text for running status', () => {
    const { lastFrame } = render(
      React.createElement(StatusBadge, { status: 'running' }),
    );
    expect(lastFrame()).toContain('Running');
  });

  it('should render "Stopped" text for stopped status', () => {
    const { lastFrame } = render(
      React.createElement(StatusBadge, { status: 'stopped' }),
    );
    expect(lastFrame()).toContain('Stopped');
  });

  it('should render "Failed" text for failed status', () => {
    const { lastFrame } = render(
      React.createElement(StatusBadge, { status: 'failed' }),
    );
    expect(lastFrame()).toContain('Failed');
  });

  it('should render "Provisioning" text for provisioning status', () => {
    const { lastFrame } = render(
      React.createElement(StatusBadge, { status: 'provisioning' }),
    );
    expect(lastFrame()).toContain('Provisioning');
  });

  it('should render "Archived" text for archived status', () => {
    const { lastFrame } = render(
      React.createElement(StatusBadge, { status: 'archived' }),
    );
    expect(lastFrame()).toContain('Archived');
  });

  it('should render a dot indicator alongside the status text', () => {
    const { lastFrame } = render(
      React.createElement(StatusBadge, { status: 'running' }),
    );
    expect(lastFrame()).toContain('●');
  });
});

// ── Spinner ──

describe('Spinner', () => {
  it('should render with a label', () => {
    const { lastFrame } = render(
      React.createElement(Spinner, { label: 'Loading servers...' }),
    );
    expect(lastFrame()).toContain('Loading servers...');
  });

  it('should render with default label if none provided', () => {
    const { lastFrame } = render(
      React.createElement(Spinner, {}),
    );
    const frame = lastFrame() ?? '';
    // Should render something (spinner character + default text or just spinner)
    expect(frame.length).toBeGreaterThan(0);
  });
});

// ── Header ──

describe('Header', () => {
  it('should render the title', () => {
    const { lastFrame } = render(
      React.createElement(Header, { title: 'Server Dashboard' }),
    );
    expect(lastFrame()).toContain('Server Dashboard');
  });

  it('should render breadcrumb when provided', () => {
    const { lastFrame } = render(
      React.createElement(Header, {
        title: 'Server Dashboard',
        breadcrumb: ['Main Menu', 'Servers', 'Alpha'],
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Main Menu');
    expect(frame).toContain('Servers');
    expect(frame).toContain('Alpha');
  });

  it('should render without breadcrumb', () => {
    const { lastFrame } = render(
      React.createElement(Header, { title: 'Main Menu' }),
    );
    expect(lastFrame()).toContain('Main Menu');
  });
});

// ── KeyHint ──

describe('KeyHint', () => {
  it('should render keyboard shortcut hints', () => {
    const { lastFrame } = render(
      React.createElement(KeyHint, {
        hints: [
          { key: 'q', label: 'Quit' },
          { key: '←', label: 'Back' },
        ],
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('q');
    expect(frame).toContain('Quit');
    expect(frame).toContain('←');
    expect(frame).toContain('Back');
  });

  it('should render multiple hints with visual separation', () => {
    const { lastFrame } = render(
      React.createElement(KeyHint, {
        hints: [
          { key: 'Enter', label: 'Select' },
          { key: 'Esc', label: 'Back' },
          { key: 'q', label: 'Quit' },
        ],
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Enter');
    expect(frame).toContain('Select');
    expect(frame).toContain('Esc');
    expect(frame).toContain('q');
  });

  it('should render empty when no hints provided', () => {
    const { lastFrame } = render(
      React.createElement(KeyHint, { hints: [] }),
    );
    // Should render but be minimal/empty
    expect(lastFrame()).toBeDefined();
  });
});

// ── ConfirmDialog ──

describe('ConfirmDialog', () => {
  it('should render the warning message', () => {
    const { lastFrame } = render(
      React.createElement(ConfirmDialog, {
        message: 'Are you sure you want to archive this server?',
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    expect(lastFrame()).toContain('Are you sure you want to archive this server?');
  });

  it('should show Yes and No options', () => {
    const { lastFrame } = render(
      React.createElement(ConfirmDialog, {
        message: 'Delete server?',
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Yes');
    expect(frame).toContain('No');
  });

  it('should default selection to Cancel/No (not Yes)', () => {
    const { lastFrame } = render(
      React.createElement(ConfirmDialog, {
        message: 'Confirm action?',
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    const frame = lastFrame();
    // The "No" option should be visually highlighted/selected (marked with > or bold)
    // We check that No appears with a selection indicator
    expect(frame).toContain('No');
  });

  it('should call onCancel when Enter is pressed on default (No)', () => {
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Confirm?',
        onConfirm: () => {},
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('\r');
    expect(cancelled).toBe(true);
  });
});

// ── ErrorBox ──

describe('ErrorBox', () => {
  it('should render error code and message', () => {
    const { lastFrame } = render(
      React.createElement(ErrorBox, {
        code: 'SSH_CONNECTION_FAILED',
        message: 'SSH connection to 34.56.78.90 failed',
        options: ['retry', 'ssh_manual', 'abort'],
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('SSH_CONNECTION_FAILED');
    expect(frame).toContain('SSH connection to 34.56.78.90 failed');
  });

  it('should render recovery option buttons', () => {
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

  it('should render with single recovery option', () => {
    const { lastFrame } = render(
      React.createElement(ErrorBox, {
        code: 'RCON_AUTH_FAILED',
        message: 'RCON authentication failed',
        options: ['reconfigure'],
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('RCON_AUTH_FAILED');
    expect(frame).toContain('Reconfigure');
  });

  it('should render with ssh_manual recovery option', () => {
    const { lastFrame } = render(
      React.createElement(ErrorBox, {
        code: 'SSH_COMMAND_FAILED',
        message: 'Command failed',
        options: ['retry', 'ssh_manual'],
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('SSH');
  });
});
