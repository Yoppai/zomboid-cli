/**
 * Phase 4 Task 4.2 — tests/presentation/components/select-list.keyboard.test.tsx
 *
 * Keyboard tests for SelectList component.
 * Uses ink-testing-library's stdin (which pipes through the reconciler)
 * with helper functions from createFakeStdin for consistent key sequences.
 *
 * TDD cycle: RED (new keyboard coverage tests) → GREEN (existing impl passes)
 */
import { describe, it, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { createFakeStdin } from '../../helpers/fake-stdin.ts';
import { SelectList } from '@/presentation/components/SelectList.tsx';

const items = [
  { label: 'Create New Server', value: 'create' },
  { label: 'Active Servers', value: 'active' },
  { label: 'Archived Servers', value: 'archived' },
  { label: 'Global Settings', value: 'settings' },
] as const;

/**
 * Drive stdin via the ink-testing-library renderer's stdin object.
 * The renderer's stdin is what useInput hooks listen to — not process.stdin.
 * Use createFakeStdin to get consistent key helpers (enter, arrowDown, etc.)
 * but write to the renderer's stdin, not process.stdin.
 */
function withFakeStdin<T>(
  renderer: { stdin: { write: (s: string) => void } },
  fn: (fake: ReturnType<typeof createFakeStdin>) => T,
): T {
  const fake = createFakeStdin();
  // Override write to go to renderer's stdin instead of process.stdin
  fake.write = async (text: string) => {
    renderer.stdin.write(text);
  };
  return fn(fake);
}

describe('SelectList keyboard (render + fake-stdin helpers)', () => {
  it('should call onSelect with item value on Enter', () => {
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    stdin.write('\r'); // CR = Enter on first item
    expect(selected).toBe('create');
  });

  it('should call onSelect with second item after down+Enter', () => {
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    stdin.write('\x1B[B'); // Down arrow
    stdin.write('\r'); // Enter
    expect(selected).toBe('active');
  });

  it('should call onSelect with third item after 2x down+Enter', () => {
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    stdin.write('\x1B[B');
    stdin.write('\x1B[B');
    stdin.write('\r');
    expect(selected).toBe('archived');
  });

  it('should skip disabled items when navigating down', () => {
    const itemsWithDisabled = [
      { label: 'GCP', value: 'gcp' },
      { label: 'AWS (Coming Soon)', value: 'aws', disabled: true },
      { label: 'Azure (Coming Soon)', value: 'azure', disabled: true },
      { label: 'Other', value: 'other' },
    ] as const;
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items: itemsWithDisabled,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    stdin.write('\x1B[B'); // Skip disabled → land on 'other'
    stdin.write('\r');
    expect(selected).toBe('other');
  });

  it('should not call onSelect when focused prop is false', () => {
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items,
        onSelect: (value: string) => { selected = value; },
        focused: false,
      }),
    );
    stdin.write('\r');
    expect(selected).toBe(''); // No selection when not focused
  });

  it('should navigate up from second item to first', () => {
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    stdin.write('\x1B[B'); // Move to second item
    stdin.write('\x1B[A'); // Move back to first item
    stdin.write('\r');
    expect(selected).toBe('create');
  });

  it('should clamp at first item when pressing up arrow at top', () => {
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    stdin.write('\x1B[A'); // Already at top — should stay
    stdin.write('\r');
    expect(selected).toBe('create'); // First item still selected
  });

  it('should clamp at last item when pressing down past end', () => {
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    // Navigate down 5 times — should clamp at 'settings' (last item index 3)
    stdin.write('\x1B[B');
    stdin.write('\x1B[B');
    stdin.write('\x1B[B');
    stdin.write('\x1B[B');
    stdin.write('\x1B[B'); // This one should clamp but still work
    stdin.write('\r');
    expect(selected).toBe('settings');
  });

  it('should call onSelect when pressing Enter on enabled first item', () => {
    const itemsWithDisabled = [
      { label: 'GCP', value: 'gcp' },
      { label: 'AWS (Coming Soon)', value: 'aws', disabled: true },
      { label: 'Other', value: 'other' },
    ] as const;
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items: itemsWithDisabled,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    stdin.write('\r'); // 'gcp' is first enabled — should call onSelect
    expect(selected).toBe('gcp');
  });
});
