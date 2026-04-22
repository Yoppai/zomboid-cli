import React from 'react';
import { Box, Text, useInput } from 'ink';

// ── Props ──

export interface TabBarProps {
  readonly tabs: readonly string[];
  readonly activeIndex: number;
  readonly onTabChange: (index: number) => void;
}

// ── Component ──

export function TabBar({ tabs, activeIndex, onTabChange }: TabBarProps) {
  useInput((_input, key) => {
    if (key.rightArrow && activeIndex < tabs.length - 1) {
      onTabChange(activeIndex + 1);
    } else if (key.leftArrow && activeIndex > 0) {
      onTabChange(activeIndex - 1);
    }
  });

  return React.createElement(
    Box,
    { gap: 1 },
    ...tabs.map((tab, i) => {
      const isActive = i === activeIndex;
      return React.createElement(
        Text,
        {
          key: `tab-${i}`,
          bold: isActive,
          color: isActive ? 'cyan' : undefined,
          dimColor: !isActive,
        },
        isActive ? `[${tab}]` : ` ${tab} `,
      );
    }),
  );
}
