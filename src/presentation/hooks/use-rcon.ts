import { useState, useCallback } from 'react';
import { useServices } from './use-services.tsx';
import type { SshConnectionConfig, PlayerInfo } from '@/domain/entities/value-objects.ts';

export function useRcon() {
  const { rcon } = useServices();
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<readonly PlayerInfo[]>([]);

  const connect = useCallback(async (conn: SshConnectionConfig, password: string) => {
    await rcon.connect(conn, password);
    setConnected(true);
  }, [rcon]);

  const disconnect = useCallback(async () => {
    await rcon.disconnect();
    setConnected(false);
  }, [rcon]);

  const getPlayers = useCallback(async () => {
    const list = await rcon.players();
    setPlayers(list);
    return list;
  }, [rcon]);

  const kick = useCallback(async (username: string) => {
    await rcon.kick(username);
    await getPlayers();
  }, [rcon, getPlayers]);

  const ban = useCallback(async (username: string) => {
    await rcon.ban(username);
    await getPlayers();
  }, [rcon, getPlayers]);

  const broadcast = useCallback(async (message: string) => {
    await rcon.broadcast(message);
  }, [rcon]);

  return {
    connected,
    players,
    connect,
    disconnect,
    getPlayers,
    kick,
    ban,
    broadcast,
  };
}
