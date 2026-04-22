import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

// ── Spinner frames ──

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ── Props ──

export interface SpinnerProps {
  readonly label?: string;
}

// ── Component ──

export function Spinner({ label }: SpinnerProps) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  const frame = SPINNER_FRAMES[frameIndex]!;
  const text = label ? `${frame} ${label}` : frame;

  return React.createElement(Text, { color: 'cyan' }, text);
}
