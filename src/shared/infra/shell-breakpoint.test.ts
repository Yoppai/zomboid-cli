import { describe, it, expect } from 'bun:test';
import { getShellBreakpoint, type ShellBreakpoint } from '@/shared/infra/navigation-store.ts';

describe('getShellBreakpoint', () => {
  it('returns narrow when columns < 90', () => {
    expect(getShellBreakpoint(80)).toBe('narrow');
    expect(getShellBreakpoint(50)).toBe('narrow');
    expect(getShellBreakpoint(89)).toBe('narrow');
  });

  it('returns default when 90 <= columns < 120', () => {
    expect(getShellBreakpoint(90)).toBe('default');
    expect(getShellBreakpoint(100)).toBe('default');
    expect(getShellBreakpoint(119)).toBe('default');
  });

  it('returns wide when columns >= 120', () => {
    expect(getShellBreakpoint(120)).toBe('wide');
    expect(getShellBreakpoint(150)).toBe('wide');
    expect(getShellBreakpoint(200)).toBe('wide');
  });
});
