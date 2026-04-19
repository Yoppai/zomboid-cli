import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, useInput, useFocus } from 'ink';

// ── Types ──

export interface SelectListItem {
  readonly label: string;
  readonly value: string;
  readonly disabled?: boolean;
}

export interface SelectListProps {
  readonly items: readonly SelectListItem[];
  readonly onSelect: (value: string) => void;
  readonly focusId?: string;
  readonly focused?: boolean;
}

// ── Helpers ──

function findNextEnabled(items: readonly SelectListItem[], from: number, direction: 1 | -1): number {
  let idx = from + direction;
  while (idx >= 0 && idx < items.length) {
    if (!items[idx]!.disabled) return idx;
    idx += direction;
  }
  return from; // no enabled item found — stay put
}

// ── Component ──

export function SelectList({ items, onSelect, focusId, focused }: SelectListProps) {
  const { isFocused: inkFocused } = useFocus({ isActive: focusId !== undefined, id: focusId });
  const isFocused = focused !== undefined ? focused : (focusId !== undefined ? inkFocused : true);
  
  const firstEnabled = items.findIndex((item) => !item.disabled);
  const initialIndex = firstEnabled >= 0 ? firstEnabled : 0;

  // useRef for synchronous index tracking (useInput reads must be instant)
  const indexRef = useRef(initialIndex);
  const [renderIndex, setRenderIndex] = useState(initialIndex);

  useEffect(() => {
    const maxIdx = Math.max(0, items.length - 1);
    if (indexRef.current > maxIdx) {
      indexRef.current = maxIdx;
      setRenderIndex(maxIdx);
    }
  }, [items.length]);

  useInput((_input, key) => {
    if (!isFocused) return;

    if (key.downArrow) {
      const next = findNextEnabled(items, indexRef.current, 1);
      indexRef.current = next;
      setRenderIndex(next);
    } else if (key.upArrow) {
      const next = findNextEnabled(items, indexRef.current, -1);
      indexRef.current = next;
      setRenderIndex(next);
    } else if (key.return) {
      const item = items[indexRef.current];
      if (item && !item.disabled) {
        onSelect(item.value);
      }
    }
  });

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    ...items.map((item, i) => {
      const isSelected = i === renderIndex;
      const indicator = isSelected ? '❯' : ' ';

      if (item.disabled) {
        return React.createElement(
          Box,
          { key: `item-${i}` },
          React.createElement(Text, { dimColor: true }, `  ${item.label}`),
        );
      }

      return React.createElement(
        Box,
        { key: `item-${i}` },
        React.createElement(
          Text,
          {
            color: isSelected ? 'cyan' : undefined,
            bold: isSelected,
            dimColor: !isFocused,
          },
          `${indicator} ${item.label}`,
        ),
      );
    }),
  );
}
