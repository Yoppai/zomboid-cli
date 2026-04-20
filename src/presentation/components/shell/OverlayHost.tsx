import React from 'react';
import { Box } from 'ink';

export interface OverlayHostProps {
  readonly dimmed: boolean;
  readonly children: React.ReactNode;
}

export function OverlayHost({ dimmed, children }: OverlayHostProps) {
  return (
    <>
      {dimmed && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          backgroundColor="gray"
        />
      )}
      {children}
    </>
  );
}
