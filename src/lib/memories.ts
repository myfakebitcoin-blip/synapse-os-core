import { supabase } from './supabase';

export interface UserMemory {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export async function listMemories(): Promise<UserMemory[]> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const { data, error } = await supabase
    .from('user_memories')
    .select('id,user_id,content,created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function saveMemory(content: string): Promise<UserMemory> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const { data, error } = await supabase
    .from('user_memories')
    .insert({ content: content.trim() })
    .select('id,user_id,content,created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMemory(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const { error } = await supabase.from('user_memories').delete().eq('id', id);
  if (error) throw error;
}
