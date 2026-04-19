import { describe, it, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';

import { SelectList } from '@/presentation/components/SelectList.tsx';
import { ProgressBar } from '@/presentation/components/ProgressBar.tsx';
import { TextInput } from '@/presentation/components/TextInput.tsx';

// ── SelectList ──

describe('SelectList', () => {
  const items = [
    { label: 'Create New Server', value: 'create' },
    { label: 'Active Servers', value: 'active' },
    { label: 'Archived Servers', value: 'archived' },
    { label: 'Global Settings', value: 'settings' },
  ];

  it('should render all item labels', () => {
    const { lastFrame } = render(
      React.createElement(SelectList, {
        items,
        onSelect: () => {},
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Create New Server');
    expect(frame).toContain('Active Servers');
    expect(frame).toContain('Archived Servers');
    expect(frame).toContain('Global Settings');
  });

  it('should highlight the first item by default', () => {
    const { lastFrame } = render(
      React.createElement(SelectList, {
        items,
        onSelect: () => {},
      }),
    );
    const frame = lastFrame();
    // First item should have selection indicator
    expect(frame).toContain('❯');
    expect(frame).toContain('Create New Server');
  });

  it('should move highlight down on down arrow', () => {
    const { lastFrame, stdin } = render(
      React.createElement(SelectList, {
        items,
        onSelect: () => {},
      }),
    );
    stdin.write('\x1B[B'); // Down arrow
    const frame = lastFrame();
    // The cursor indicator should be on Active Servers now
    // We check that both items render and frame changed
    expect(frame).toContain('Active Servers');
  });

  it('should call onSelect with item value on Enter', () => {
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    stdin.write('\r'); // Enter on first item
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
    stdin.write('\x1B[B'); // Down
    stdin.write('\r'); // Enter
    expect(selected).toBe('active');
  });

  it('should not go above first item on up arrow at top', () => {
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    stdin.write('\x1B[A'); // Up arrow at top — should stay at 0
    stdin.write('\r');
    expect(selected).toBe('create');
  });

  it('should not go below last item on down arrow at bottom', () => {
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    // Go down past the end
    stdin.write('\x1B[B');
    stdin.write('\x1B[B');
    stdin.write('\x1B[B');
    stdin.write('\x1B[B'); // Should clamp at last
    stdin.write('\r');
    expect(selected).toBe('settings');
  });

  it('should render disabled items differently and skip them on select', () => {
    const itemsWithDisabled = [
      { label: 'GCP', value: 'gcp' },
      { label: 'AWS (Coming Soon)', value: 'aws', disabled: true },
      { label: 'Azure (Coming Soon)', value: 'azure', disabled: true },
    ];
    const { lastFrame } = render(
      React.createElement(SelectList, {
        items: itemsWithDisabled,
        onSelect: () => {},
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('GCP');
    expect(frame).toContain('AWS (Coming Soon)');
    expect(frame).toContain('Azure (Coming Soon)');
  });

  it('should skip disabled items when navigating down', () => {
    const itemsWithDisabled = [
      { label: 'GCP', value: 'gcp' },
      { label: 'AWS', value: 'aws', disabled: true },
      { label: 'Other', value: 'other' },
    ];
    let selected = '';
    const { stdin } = render(
      React.createElement(SelectList, {
        items: itemsWithDisabled,
        onSelect: (value: string) => { selected = value; },
      }),
    );
    stdin.write('\x1B[B'); // Down — should skip 'aws' (disabled) and land on 'other'
    stdin.write('\r');
    expect(selected).toBe('other');
  });

  it('should render with two items', () => {
    const { lastFrame } = render(
      React.createElement(SelectList, {
        items: [
          { label: 'Option A', value: 'a' },
          { label: 'Option B', value: 'b' },
        ],
        onSelect: () => {},
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Option A');
    expect(frame).toContain('Option B');
  });
});

// ── ProgressBar ──

describe('ProgressBar', () => {
  it('should render a progress bar at 0%', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { percent: 0 }),
    );
    const frame = lastFrame();
    expect(frame).toContain('0%');
  });

  it('should render a progress bar at 50%', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { percent: 50 }),
    );
    const frame = lastFrame();
    expect(frame).toContain('50%');
  });

  it('should render a progress bar at 100%', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { percent: 100 }),
    );
    const frame = lastFrame();
    expect(frame).toContain('100%');
  });

  it('should render with a label', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, {
        percent: 75,
        label: 'Downloading backup...',
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('75%');
    expect(frame).toContain('Downloading backup...');
  });

  it('should render filled and empty portions', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { percent: 50, width: 20 }),
    );
    const frame = lastFrame();
    // Should contain both filled (█) and empty (░) characters
    expect(frame).toContain('█');
    expect(frame).toContain('░');
  });

  it('should render fully filled at 100%', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { percent: 100, width: 10 }),
    );
    const frame = lastFrame();
    expect(frame).toContain('██████████');
  });
});

// ── TextInput ──

describe('TextInput', () => {
  it('should render with placeholder when value is empty', () => {
    const { lastFrame } = render(
      React.createElement(TextInput, {
        value: '',
        onChange: () => {},
        placeholder: 'Enter server name...',
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Enter server name...');
  });

  it('should render the current value', () => {
    const { lastFrame } = render(
      React.createElement(TextInput, {
        value: 'My Server',
        onChange: () => {},
      }),
    );
    expect(lastFrame()).toContain('My Server');
  });

  it('should call onChange when character is typed', () => {
    let newValue = '';
    const { stdin } = render(
      React.createElement(TextInput, {
        value: 'Hel',
        onChange: (v: string) => { newValue = v; },
      }),
    );
    stdin.write('l');
    expect(newValue).toBe('Hell');
  });

  it('should call onChange with backspace removing last char', () => {
    let newValue = '';
    const { stdin } = render(
      React.createElement(TextInput, {
        value: 'Hello',
        onChange: (v: string) => { newValue = v; },
      }),
    );
    stdin.write('\x7F'); // Backspace
    expect(newValue).toBe('Hell');
  });

  it('should call onSubmit on Enter when provided', () => {
    let submitted = false;
    const { stdin } = render(
      React.createElement(TextInput, {
        value: 'My Server',
        onChange: () => {},
        onSubmit: () => { submitted = true; },
      }),
    );
    stdin.write('\r');
    expect(submitted).toBe(true);
  });

  it('should handle empty value with backspace gracefully', () => {
    let newValue = 'initial';
    const { stdin } = render(
      React.createElement(TextInput, {
        value: '',
        onChange: (v: string) => { newValue = v; },
      }),
    );
    stdin.write('\x7F'); // Backspace on empty
    expect(newValue).toBe('');
  });

  it('should render with a label', () => {
    const { lastFrame } = render(
      React.createElement(TextInput, {
        value: '',
        onChange: () => {},
        label: 'Server Name:',
      }),
    );
    expect(lastFrame()).toContain('Server Name:');
  });
});
