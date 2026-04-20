import React from 'react';
import { Box, useWindowSize } from 'ink';
import { HeroTitle } from '@/presentation/components/shell/HeroTitle.tsx';
import { ShellHeader } from '@/presentation/components/shell/ShellHeader.tsx';
import { SidebarNav } from '@/presentation/components/shell/SidebarNav.tsx';
import { ContentFrame } from '@/presentation/components/shell/ContentFrame.tsx';
import { ShellFooter } from '@/presentation/components/shell/ShellFooter.tsx';
import type { ShellContext, FocusRegion } from '@/presentation/store/navigation-store.ts';

export interface ShellFrameProps {
  readonly version: string;
  readonly activeCount: number;
  readonly totalCount: number;
  readonly context: ShellContext;
  readonly focusRegion: FocusRegion;
  readonly footerHints: readonly string[];
  readonly onSelect: (key: string) => void;
  readonly onServerSelect: (tab: string) => void;
  readonly children: React.ReactNode;
}

/**
 * ShellFrame — global layout frame for dashboard shell.
 *
 * Layout order (top to bottom):
 *   terminalHeight
 *     - heroHeight  (2 rows, BigText or fallback)
 *     - headerHeight (TitledBox round with "System Status")
 *     - centralRowHeight (flexGrow=1, row layout)
 *         - sidebar ~35% (responsive)
 *         - spacer
 *         - main flexGrow=1
 *     - footerHeight (1-2 rows, space-between badges)
 *
 * Hero uses BigText on wide terminals (>= 100 cols),
 * falls back to bordered Text on narrow terminals (>= 50 cols).
 * Below 50 cols, hero returns null to save space.
 */
export function ShellFrame({
  version,
  activeCount,
  totalCount,
  context,
  focusRegion,
  footerHints,
  onSelect,
  onServerSelect,
  children,
}: ShellFrameProps) {
  const { columns } = useWindowSize();

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Hero — BigText with TTY-safe fallback. Fixed 2-row reservation. */}
      <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={2}>
        <HeroTitle columns={columns} />
      </Box>

      {/* Header — TitledBox round with embedded "System Status" title */}
      <ShellHeader version={version} activeCount={activeCount} totalCount={totalCount} />

      {/* Central row — sidebar + spacer + main content, flexGrow=1 */}
      <Box flexDirection="row" flexGrow={1}>
        <SidebarNav
          context={context}
          focusRegion={focusRegion}
          onSelect={onSelect}
          onServerSelect={onServerSelect}
        />
        <Box width={1} />
        <ContentFrame context={context}>
          {children}
        </ContentFrame>
      </Box>

      {/* Footer — pinned bottom, space-between badges, no border */}
      <ShellFooter hints={footerHints} />
    </Box>
  );
}
