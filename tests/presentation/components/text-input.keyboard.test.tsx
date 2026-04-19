/**
 * Phase 4 Task 4.3 — tests/presentation/components/text-input.keyboard.test.tsx
 *
 * Keyboard tests for TextInput component.
 * Tests: char input, backspace, Enter submit, escape/arrow ignored keys, focused prop.
 *
 * TDD cycle: RED (new keyboard coverage tests) → GREEN (existing impl passes)
 */
import { describe, it, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { TextInput } from '@/presentation/components/TextInput.tsx';

describe('TextInput keyboard', () => {
  it('should call onChange when character is typed', () => {
    let newValue = '';
    const { stdin } = render(
      React.createElement(TextInput, {
        value: '',
        onChange: (v: string) => { newValue = v; },
      }),
    );
    stdin.write('H');
    stdin.write('i');
    stdin.write('!');
    expect(newValue).toBe('Hi!');
  });

  it('should call onChange with backspace removing last char', () => {
    let newValue = '';
    const { stdin } = render(
      React.createElement(TextInput, {
        value: 'Hello',
        onChange: (v: string) => { newValue = v; },
      }),
    );
    stdin.write('\x7F'); // Backspace (DEL)
    expect(newValue).toBe('Hell');
  });

  it('should call onSubmit on Enter', () => {
    let submitted = '';
    const { stdin } = render(
      React.createElement(TextInput, {
        value: 'My Server',
        onChange: () => {},
        onSubmit: (v: string) => { submitted = v; },
      }),
    );
    stdin.write('\r');
    expect(submitted).toBe('My Server');
  });

  it('should ignore arrow keys (no onChange call)', () => {
    let callCount = 0;
    const { stdin } = render(
      React.createElement(TextInput, {
        value: 'Initial',
        onChange: () => { callCount++; },
      }),
    );
    stdin.write('\x1B[A'); // Up arrow — ignored
    stdin.write('\x1B[B'); // Down arrow — ignored
    stdin.write('\x1B[C'); // Right arrow — ignored
    stdin.write('\x1B[D'); // Left arrow — ignored
    expect(callCount).toBe(0);
  });

  it('should ignore Tab key', () => {
    let callCount = 0;
    const { stdin } = render(
      React.createElement(TextInput, {
        value: 'Test',
        onChange: () => { callCount++; },
      }),
    );
    stdin.write('\t');
    expect(callCount).toBe(0);
  });

  it('should not call onSubmit when focused prop is false', () => {
    let submitted = false;
    const { stdin } = render(
      React.createElement(TextInput, {
        value: 'Test',
        onChange: () => {},
        onSubmit: () => { submitted = true; },
        focused: false,
      }),
    );
    stdin.write('\r');
    expect(submitted).toBe(false);
  });

  it('should handle empty value backspace gracefully', () => {
    let newValue = 'unchanged';
    const { stdin } = render(
      React.createElement(TextInput, {
        value: '',
        onChange: (v: string) => { newValue = v; },
      }),
    );
    stdin.write('\x7F'); // Backspace on empty
    expect(newValue).toBe('');
  });

  it('should accumulate characters correctly', () => {
    let newValue = '';
    const { stdin } = render(
      React.createElement(TextInput, {
        value: '',
        onChange: (v: string) => { newValue = v; },
      }),
    );
    stdin.write('s');
    stdin.write('e');
    stdin.write('r');
    stdin.write('v');
    stdin.write('e');
    stdin.write('r');
    expect(newValue).toBe('server');
  });

  it('should call onSubmit on each Enter press', () => {
    let submitCount = 0;
    const { stdin } = render(
      React.createElement(TextInput, {
        value: 'Test',
        onChange: () => {},
        onSubmit: () => { submitCount++; },
      }),
    );
    stdin.write('\r');
    stdin.write('\r');
    stdin.write('\r');
    expect(submitCount).toBe(3);
  });

  it('should render placeholder when value is empty', () => {
    const { lastFrame } = render(
      React.createElement(TextInput, {
        value: '',
        onChange: () => {},
        placeholder: 'Enter server name...',
      }),
    );
    expect(lastFrame()).toContain('Enter server name...');
  });

  it('should render current value with cursor', () => {
    const { lastFrame } = render(
      React.createElement(TextInput, {
        value: 'My Server',
        onChange: () => {},
      }),
    );
    expect(lastFrame()).toContain('My Server');
  });

  it('should call onChange on each character typed', () => {
    const changes: string[] = [];
    const { stdin } = render(
      React.createElement(TextInput, {
        value: '',
        onChange: (v: string) => { changes.push(v); },
      }),
    );
    stdin.write('A');
    stdin.write('B');
    stdin.write('C');
    expect(changes).toEqual(['A', 'AB', 'ABC']);
  });
});
