import { describe, it, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { HeroTitle } from '@/presentation/components/shell/HeroTitle.tsx';

describe('HeroTitle', () => {
  it('renders BigText when columns >= 100', () => {
    const { lastFrame } = render(<HeroTitle columns={120} />);
    // BigText renders ASCII art — verify presence of box-drawing chars that form the art
    const frame = lastFrame();
    expect(frame).toContain('\u2588'); // █ — block char present in BigText art
  });

  it('renders fallback Text when columns < 100', () => {
    const { lastFrame } = render(<HeroTitle columns={80} />);
    expect(lastFrame()).toContain('ZOMBOID-CLI');
  });

  it('renders BigText at boundary columns=100', () => {
    const { lastFrame } = render(<HeroTitle columns={100} />);
    // BigText renders ASCII art — verify presence of box-drawing chars
    const frame = lastFrame();
    expect(frame).toContain('\u2588'); // █ — block char present in BigText art
  });

  it('renders fallback at columns=90 (default breakpoint)', () => {
    const { lastFrame } = render(<HeroTitle columns={90} />);
    expect(lastFrame()).toContain('ZOMBOID-CLI');
  });

  it('renders fallback at columns=80 (narrow)', () => {
    const { lastFrame } = render(<HeroTitle columns={80} />);
    expect(lastFrame()).toContain('ZOMBOID-CLI');
  });

  it('renders fallback at columns=50 (min fallback)', () => {
    const { lastFrame } = render(<HeroTitle columns={50} />);
    expect(lastFrame()).toContain('ZOMBOID-CLI');
  });

  it('returns null when columns < 50', () => {
    const { lastFrame } = render(<HeroTitle columns={30} />);
    expect(lastFrame()).toBe('');
  });

  it('returns null at columns=49 (below min)', () => {
    const { lastFrame } = render(<HeroTitle columns={49} />);
    expect(lastFrame()).toBe('');
  });
});
