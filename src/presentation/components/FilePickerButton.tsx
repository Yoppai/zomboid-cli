import React from 'react';
import { Box, Text } from 'ink';
import * as path from 'node:path';

// ── Props ──

export interface FilePickerButtonProps {
  readonly label: string;
  readonly onSelect: (filePath: string) => void;
  readonly selectedFile?: string;
}

// ── Component ──

export function FilePickerButton({ label, selectedFile }: FilePickerButtonProps) {
  const displayName = selectedFile
    ? path.basename(selectedFile)
    : 'No file selected';

  return React.createElement(
    Box,
    { gap: 1 },
    React.createElement(
      Text,
      { color: 'cyan', bold: true },
      `[${label}]`,
    ),
    React.createElement(
      Text,
      { dimColor: !selectedFile },
      displayName,
    ),
  );
}
