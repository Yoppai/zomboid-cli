import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

// ── Props ──

export interface ConfirmDialogProps {
  readonly message: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

// ── Component ──

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  // Default selection is 1 = "No" (Cancel is default per spec)
  const [selected, setSelected] = useState(1);

  useInput((input, key) => {
    if (key.leftArrow || input === 'h') {
      setSelected(0); // Yes
    } else if (key.rightArrow || input === 'l') {
      setSelected(1); // No
    } else if (input.toLowerCase() === 'y') {
      onConfirm();
    } else if (input.toLowerCase() === 'n') {
      onCancel();
    } else if (key.return) {
      if (selected === 0) {
        onConfirm();
      } else {
        onCancel();
      }
    } else if (key.escape) {
      onCancel();
    }
  });

  const yesStyle = selected === 0
    ? { bold: true, color: 'red' as const }
    : { dimColor: true };
  const noStyle = selected === 1
    ? { bold: true, color: 'green' as const }
    : { dimColor: true };

  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'round', borderColor: 'yellow', paddingX: 1 },
    React.createElement(Text, { color: 'yellow', bold: true }, '⚠ Confirm'),
    React.createElement(Text, null, message),
    React.createElement(
      Box,
      { marginTop: 1, gap: 2 },
      React.createElement(
        Text,
        yesStyle,
        selected === 0 ? '> Yes' : '  Yes',
      ),
      React.createElement(
        Text,
        noStyle,
        selected === 1 ? '> No' : '  No',
      ),
    ),
  );
}
