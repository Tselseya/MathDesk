import { createClient, type AuthChangeEvent, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';

export interface ChatMessageRecord {
  role: 'user' | 'ai';
  content: string;
  imagePreviews?: string[];
}

export interface SupabaseHistory {
  messages: ChatMessageRecord[];
  created_at?: string;
}

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);
export const supabase: SupabaseClient | null = supabaseConfigured ? createClient(url!, anonKey!) : null;

export async function signUp(name: string, email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured. Add the Supabase variables to .env.local.');
  return supabase.auth.signUp({ email, password, options: { data: { name } } });
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured. Add the Supabase variables to .env.local.');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (!supabase) return { error: null };
  return supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export function onAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => undefined } } };
  return supabase.auth.onAuthStateChange(callback);
}

export async function saveChatHistory(messages: ChatMessageRecord[]) {
  const user = await getCurrentUser();
  if (!supabase || !user || messages.length === 0) return;
  const { error } = await supabase.from('chat_history').upsert(
    { user_id: user.id, messages, created_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function loadChatHistory(): Promise<ChatMessageRecord[]> {
  const user = await getCurrentUser();
  if (!supabase || !user) return [];
  const { data, error } = await supabase
    .from('chat_history')
    .select('messages')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const history = data?.messages as SupabaseHistory['messages'] | undefined;
  return Array.isArray(history) ? history : [];
}
