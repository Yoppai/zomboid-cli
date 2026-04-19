import { useEffect, useState } from 'react';
import { useServices } from './use-services.tsx';
import type { ServerRecord } from '@/domain/entities/server-record.ts';
import { createServerId } from '@/domain/entities/enums.ts';

export function useServer(serverId: string) {
  const { inventory } = useServices();
  const [server, setServer] = useState<ServerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    inventory.getServer(createServerId(serverId))
      .then(data => {
        if (mounted) {
          setServer(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err as Error);
          setLoading(false);
        }
      });
      
    return () => { mounted = false; };
  }, [serverId, inventory]);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await inventory.getServer(createServerId(serverId));
      setServer(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { server, loading, error, reload };
}
