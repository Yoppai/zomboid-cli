import React from 'react';
import { Box, Text } from 'ink';
import { TitledBox } from '@mishieck/ink-titled-box';
import { useTranslation } from '@/shared/hooks/use-translation.ts';
import type { ShellContext } from '@/shared/infra/navigation-store.ts';

export interface ContentFrameProps {
  readonly context: ShellContext;
  readonly children: React.ReactNode;
}

// i18n key map for main content titles
function getTitleKey(context: ShellContext): string {
  if (context.kind === 'main') {
    switch (context.panel) {
      case 'active-servers': return 'main.active_servers';
      case 'archived': return 'main.archived_servers';
      case 'global-settings': return 'main.global_settings';
    }
  }
  switch (context.tab) {
    case 'management': return 'main.management';
    case 'build': return 'main.build';
    case 'players': return 'main.players';
    case 'stats': return 'main.stats';
    case 'basic': return 'main.basic';
    case 'advanced': return 'main.advanced';
    case 'admins': return 'main.admins';
    case 'scheduler': return 'main.scheduler';
    case 'backups': return 'main.backups';
    default: return 'main.management';
  }
}

export function ContentFrame({ context, children }: ContentFrameProps) {
  const t = useTranslation();
  const titleKey = getTitleKey(context);

  return (
    <TitledBox
      borderStyle="round"
      titles={[t(titleKey)]}
      flexGrow={1}
    >
      {/* Main content area */}
      <Box flexGrow={1} paddingX={1} paddingY={0}>
        {children}
      </Box>
    </TitledBox>
  );
}
