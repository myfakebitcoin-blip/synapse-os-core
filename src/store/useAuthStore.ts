import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: false,
  error: null,

  initialize: () => {
    if (!supabase) return () => undefined;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) set({ error: error.message });
      set({ session: data.session, user: data.session?.user ?? null });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, error: null });
    });
    return () => subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    if (!supabase) throw new Error('Supabase não está configurado.');
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível entrar.';
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email, password) => {
    if (!supabase) throw new Error('Supabase não está configurado.');
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível criar a conta.';
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) set({ error: error.message });
  }
}));
