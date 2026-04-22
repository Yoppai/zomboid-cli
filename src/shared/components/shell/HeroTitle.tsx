import React from 'react';
import { Box, Text } from 'ink';
import BigText from 'ink-big-text';


export interface HeroTitleProps {
  readonly columns: number;
}

const MIN_COLUMNS_FALLBACK = 50;
const MIN_COLUMNS_BIGTEXT = 100;

function isWide(columns: number): boolean {
  return columns >= MIN_COLUMNS_BIGTEXT;
}

function isRenderable(columns: number): boolean {
  return columns >= MIN_COLUMNS_FALLBACK;
}

/**
 * HeroTitle — isolated hero title with BigText on wide terminals
 * and TTY-safe bordered fallback on narrow terminals.
 *
 * Priority: keep footer visible > keep sidebar usable > degrade hero.
 */
export function HeroTitle({ columns }: HeroTitleProps) {
  if (!isRenderable(columns)) {
    return null;
  }

  if (isWide(columns) && BigText) {
    return (
      <BigText
        text="ZOMBOID-CLI"
        
      />
    );
  }

  // Fallback: plain centered Text — no double-box wrapping
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={2}>
      <Text bold color="cyan">ZOMBOID-CLI</Text>
    </Box>
  );
}
