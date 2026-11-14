import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface SupabaseRoomState {
  connected: boolean;
  participantCount: number;
}

export function useSupabaseRoom(roomName: string, user: User | null): SupabaseRoomState {
  const [state, setState] = useState<SupabaseRoomState>({ connected: false, participantCount: 0 });

  useEffect(() => {
    if (!supabase || !user) {
      setState({ connected: false, participantCount: 0 });
      return;
    }

    const channel = supabase.channel(`synapse-presence:${roomName}`, {
      config: { presence: { key: user.id } }
    });
    const updateCount = () => {
      const presence = channel.presenceState();
      const count = Object.values(presence).reduce((total, entries) => total + entries.length, 0);
      setState((current) => ({ ...current, participantCount: count }));
    };

    channel.on('presence', { event: 'sync' }, updateCount);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setState({ connected: true, participantCount: 1 });
        await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        updateCount();
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setState({ connected: false, participantCount: 0 });
      }
    });

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [roomName, user]);

  return state;
}
