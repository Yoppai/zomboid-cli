import React from 'react';
import { Box, Text } from 'ink';
import { useTranslation } from '@/presentation/hooks/use-translation.ts';
import type { ShellContext, ServerTabKey } from '@/presentation/store/navigation-store.ts';

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
    <Box flexDirection="column" flexGrow={1} paddingX={2} gap={0}>
      {/* Content header bar — double-line top border with icon */}
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        paddingX={1}
      >
        {/* Left: icon + title */}
        <Box gap={1} alignItems="center">
          <Text bold color="cyan">▌</Text>
          <Text bold color="white">{t(titleKey)}</Text>
        </Box>
        {/* Right: context info */}
        <Box gap={2}>
          {context.kind === 'server' && (
            <Text dimColor italic>ID:{String(context.serverId).slice(0, 6)}</Text>
          )}
          <Text dimColor>|</Text>
        </Box>
      </Box>

      {/* Main content area — double-line frame */}
      <Box
        flexGrow={1}
        borderStyle="double"
        borderColor="gray"
        paddingX={1}
        paddingY={0}
      >
        {children}
      </Box>
    </Box>
  );
}
