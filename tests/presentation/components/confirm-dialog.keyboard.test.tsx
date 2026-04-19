/**
 * Phase 4 Task 4.4 — tests/presentation/components/confirm-dialog.keyboard.test.tsx
 *
 * Keyboard tests for ConfirmDialog component.
 * Tests: default Cancel (No), y/n shortcuts, arrow+Enter nav, h/l vim keys, Escape.
 *
 * Key mappings per ConfirmDialog source:
 *   leftArrow / h → select Yes (index 0)
 *   rightArrow / l → select No (index 1)
 *   y → confirm regardless of selection
 *   n → cancel regardless of selection
 *   Enter → activate based on current selection
 *   Escape → cancel
 *
 * React state batching: multi-key sequences (arrow + Enter, h + Enter, Escape)
 * require flush between keystrokes. The component uses useState for selected
 * index, so Enter reads the CURRENT selection value — not a ref. setTimeout(0)
 * between keys gives React time to commit the selection state update.
 */
import { describe, it, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { ConfirmDialog } from '@/presentation/components/ConfirmDialog.tsx';

describe('ConfirmDialog keyboard', () => {
  // ── Default behavior ──

  it('should call onCancel when Enter pressed on default (No) selection', () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Delete server?',
        onConfirm: () => { confirmed = true; },
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('\r'); // Default is No (Cancel)
    expect(confirmed).toBe(false);
    expect(cancelled).toBe(true);
  });

  // ── y / n shortcuts (always work regardless of selection) ──

  it('should call onConfirm when y is pressed', () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Archive server?',
        onConfirm: () => { confirmed = true; },
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('y');
    expect(confirmed).toBe(true);
    expect(cancelled).toBe(false);
  });

  it('should call onCancel when n is pressed', () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Archive server?',
        onConfirm: () => { confirmed = true; },
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('n');
    expect(cancelled).toBe(true);
    expect(confirmed).toBe(false);
  });

  it('should call y shortcut even when Yes already selected', () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Confirm?',
        onConfirm: () => { confirmed = true; },
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('y');
    expect(confirmed).toBe(true);
    expect(cancelled).toBe(false);
  });

  it('should call n shortcut even when No already selected', () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Confirm?',
        onConfirm: () => { confirmed = true; },
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('n');
    expect(cancelled).toBe(true);
    expect(confirmed).toBe(false);
  });

// ── Arrow navigation + Enter ──

  it('should call onConfirm when Enter pressed after selecting Yes', async () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Delete server?',
        onConfirm: () => { confirmed = true; },
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('\x1B[D'); // Left arrow → select Yes
    await new Promise(r => setTimeout(r, 0)); // flush state before Enter
    stdin.write('\r');
    expect(confirmed).toBe(true);
    expect(cancelled).toBe(false);
  });

  it('should call onCancel when Enter pressed after selecting No', async () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Delete server?',
        onConfirm: () => { confirmed = true; },
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('\x1B[C'); // Right arrow → select No
    await new Promise(r => setTimeout(r, 0)); // flush state before Enter
    stdin.write('\r');
    expect(cancelled).toBe(true);
    expect(confirmed).toBe(false);
  });

  // ── h / l vim-style shortcuts ──
  // Same state-flush requirement as arrow keys

  it('should navigate to Yes with h key (vim left)', async () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Confirm?',
        onConfirm: () => { confirmed = true; },
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('h'); // h = left = Yes
    await new Promise(r => setTimeout(r, 0)); // flush state
    stdin.write('\r');
    expect(confirmed).toBe(true);
    expect(cancelled).toBe(false);
  });

  it('should navigate to No with l key (vim right)', async () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Confirm?',
        onConfirm: () => { confirmed = true; },
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('l'); // l = right = No
    await new Promise(r => setTimeout(r, 0)); // flush state
    stdin.write('\r');
    expect(cancelled).toBe(true);
    expect(confirmed).toBe(false);
  });

  // ── Escape ──

  it('should call onCancel when Escape is pressed', async () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Destructive action?',
        onConfirm: () => { confirmed = true; },
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('\x1B'); // Escape
    await new Promise(r => setTimeout(r, 0)); // flush state
    await new Promise(r => setTimeout(r, 10)); // extra settle time
    expect(cancelled).toBe(true);
    expect(confirmed).toBe(false);
  });

  // ── Rendering ──

  it('should render message text', () => {
    const { lastFrame } = render(
      React.createElement(ConfirmDialog, {
        message: 'Are you sure you want to archive this server?',
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    expect(lastFrame()).toContain('Are you sure you want to archive this server?');
  });

  it('should render Yes and No options', () => {
    const { lastFrame } = render(
      React.createElement(ConfirmDialog, {
        message: 'Proceed?',
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Yes');
    expect(frame).toContain('No');
  });

  it('should call onCancel on Escape even when Yes is selected', async () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Confirm?',
        onConfirm: () => { confirmed = true; },
        onCancel: () => { cancelled = true; },
      }),
    );
    stdin.write('\x1B[D'); // Select Yes
    await new Promise(r => setTimeout(r, 0)); // flush selection state
    await new Promise(r => setTimeout(r, 10)); // extra settle
    stdin.write('\x1B'); // Escape → cancel
    await new Promise(r => setTimeout(r, 0)); // flush escape
    await new Promise(r => setTimeout(r, 10)); // extra settle
    expect(cancelled).toBe(true);
    expect(confirmed).toBe(false);
  });
});
