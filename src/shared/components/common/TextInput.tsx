import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useFocus } from 'ink';

// ── Props ──

export interface TextInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit?: (value: string) => void;
  readonly placeholder?: string;
  readonly label?: string;
  readonly focusId?: string;
  readonly focused?: boolean;
}

// ── Component ──

export function TextInput({ value: propsValue, onChange, onSubmit, placeholder, label, focusId, focused }: TextInputProps) {
  const { isFocused: inkFocused } = useFocus({ id: focusId });
  const isFocused = focused !== undefined ? focused : (focusId ? inkFocused : true);
  
  // Use ref to always have the latest value in the useInput callback
  const valueRef = useRef(propsValue);
  const [renderValue, setRenderValue] = useState(propsValue);

  // Sync ref and state with props
  useEffect(() => {
    valueRef.current = propsValue;
    setRenderValue(propsValue);
  }, [propsValue]);

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.return) {
      onSubmit?.(valueRef.current);
      return;
    }

    // Backspace
    if (input === '\x7F' || key.backspace || key.delete) {
      const nextValue = valueRef.current.slice(0, -1);
      valueRef.current = nextValue;
      setRenderValue(nextValue);
      onChange(nextValue);
      return;
    }

    // Ignore control characters
    if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || key.escape || key.tab) {
      return;
    }

    // Regular character input
    if (input && input.length > 0) {
      const nextValue = valueRef.current + input;
      valueRef.current = nextValue;
      setRenderValue(nextValue);
      onChange(nextValue);
    }
  });

  const showPlaceholder = renderValue.length === 0 && placeholder;

  return React.createElement(
    Box,
    { gap: 1 },
    label
      ? React.createElement(Text, { bold: true }, label)
      : null,
    showPlaceholder
      ? React.createElement(Text, { dimColor: true }, placeholder)
      : React.createElement(Text, null, `${renderValue}${isFocused ? '█' : ''}`),
  );
}
