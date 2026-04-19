import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SelectList } from '@/presentation/components/SelectList.tsx';
import { TextInput } from '@/presentation/components/TextInput.tsx';
import { useRcon } from '@/presentation/hooks/use-rcon.ts';
import type { ServerRecord } from '@/domain/entities/server-record.ts';

export interface PlayerManagementProps {
  readonly server: ServerRecord;
}

export function PlayerManagement({ server }: PlayerManagementProps) {
  const rcon = useRcon();
  const [message, setMessage] = useState('');
  const [targetPlayer, setTargetPlayer] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'broadcast' | 'players'>('broadcast');

  useInput((_input, key) => {
    if (key.tab) {
      setActiveSection(prev => prev === 'broadcast' ? 'players' : 'broadcast');
    }
  });

  useEffect(() => {
    if (server.status === 'running' && server.staticIp) {
      rcon.connect({
        host: server.staticIp,
        port: 22,
        username: 'zomboid',
        privateKey: server.sshPrivateKey,
      }, server.rconPassword).then(() => rcon.getPlayers()).catch(console.error);
    }
    return () => {
      rcon.disconnect().catch(console.error);
    };
  }, [server.status]);

  if (!rcon.connected) {
    return <Text>Connecting to RCON...</Text>;
  }

  if (targetPlayer) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Action for: {targetPlayer}</Text>
        <SelectList
          items={[
            { label: 'Kick', value: 'kick' },
            { label: 'Ban', value: 'ban' },
            { label: 'Cancel', value: 'cancel' }
          ]}
          onSelect={async (val) => {
            if (val === 'kick') await rcon.kick(targetPlayer);
            if (val === 'ban') await rcon.ban(targetPlayer);
            setTargetPlayer(null);
          }}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold color={activeSection === 'broadcast' ? 'cyan' : undefined}>
          {activeSection === 'broadcast' ? '❯ ' : '  '}Broadcast Message
        </Text>
        <TextInput
          value={message}
          onChange={setMessage}
          onSubmit={async (val) => {
            if (val.trim()) {
              await rcon.broadcast(val);
              setMessage('');
            }
          }}
          focused={activeSection === 'broadcast'}
        />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={activeSection === 'players' ? 'cyan' : undefined}>
          {activeSection === 'players' ? '❯ ' : '  '}Connected Players ({rcon.players.length})
        </Text>
        
        {rcon.players.length === 0 ? (
          <Text>No players online.</Text>
        ) : (
          <SelectList
            items={rcon.players.map(p => ({ label: p.username, value: p.username }))}
            onSelect={setTargetPlayer}
            focused={activeSection === 'players'}
          />
        )}
      </Box>
    </Box>
  );
}
