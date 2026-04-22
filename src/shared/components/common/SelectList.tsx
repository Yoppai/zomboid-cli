import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

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
  /** Custom item renderer — receives (item, index, isSelected, isFocused, handleSelect) */
  readonly renderItem?: (
    item: SelectListItem,
    index: number,
    isSelected: boolean,
    isFocused: boolean,
  ) => React.ReactNode;
}

// ── Helpers ──

function findNextEnabled(items: readonly SelectListItem[], from: number, direction: 1 | -1): number {
  let idx = from + direction;
  while (idx >= 0 && idx < items.length) {
    if (!items[idx]!.disabled) return idx;
    idx += direction;
  }
  return from;
}

// Default simple label renderer
function defaultRenderItem(item: SelectListItem, index: number, isSelected: boolean, isFocused: boolean): React.ReactNode {
  const indicator = isSelected ? '❯' : ' ';
  return (
    <Box key={`item-${index}`}>
      <Text color={isSelected ? 'cyan' : undefined} bold={isSelected} dimColor={!isFocused}>
        {indicator} {item.label}
      </Text>
    </Box>
  );
}

// ── Component ──

export function SelectList({ items, onSelect, focusId, focused, renderItem }: SelectListProps) {
  // focused gates keyboard capture — three cases:
  // 1. focused === undefined: always capture (backward compat for standalone/inline use)
  // 2. focused === true: capture (shell main region active)
  // 3. focused === false: no capture (shell sidebar focused, main should be inactive)
  // focusId is kept for API compat but does NOT affect isFocused (useFocus removed)
  const isFocused = focused !== undefined ? focused : true;

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

  // Called inside useInput — safe because useInput is a hook (top-level)
  const handleKeyDown = useCallback((_input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean }) => {
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
  }, [isFocused, items, onSelect]);

  // useInput must be called unconditionally at top level — gating done via isFocused check inside handler
  useInput(handleKeyDown);

  const itemRenderer = renderItem ?? defaultRenderItem;

  return (
    <Box flexDirection="column">
      {items.map((item, i) => {
        const isSelected = i === renderIndex;
        return itemRenderer(item, i, isSelected, isFocused);
      })}
    </Box>
  );
}
