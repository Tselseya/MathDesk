import { createClient, type AuthChangeEvent, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import { MAX_SAVED_MESSAGES, MAX_STORED_MESSAGE_CHARS } from '../lib/limits';
import { UUID_PATTERN } from '../lib/ids';
import type { MathDeskMode } from '../types/ai';

export interface ChatMessageRecord {
  role: 'user' | 'ai';
  content: string;
  /** In-memory only: image data is never written to the database. */
  imagePreviews?: string[];
}

export interface ConversationRecord {
  id: string;
  title: string;
  mode: MathDeskMode;
  messages: ChatMessageRecord[];
  updated_at?: string;
}

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);
export const supabase: SupabaseClient | null = supabaseConfigured ? createClient(url!, anonKey!) : null;

const MODES: MathDeskMode[] = ['solve', 'learn', 'practice', 'deskbot'];

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

/** Cheap local read of the signed-in user id (no network round trip). */
export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export function onAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => undefined } } };
  return supabase.auth.onAuthStateChange(callback);
}

/** Sends a password-reset email. The link returns to the site root, where a PASSWORD_RECOVERY event fires. */
export async function requestPasswordReset(email: string) {
  if (!supabase) throw new Error('Sign-in is temporarily unavailable.');
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
}

export async function updatePassword(password: string) {
  if (!supabase) throw new Error('Sign-in is temporarily unavailable.');
  return supabase.auth.updateUser({ password });
}

/** Permanently deletes the signed-in account and all of its rows (see the delete_my_account SQL function). */
export async function deleteMyAccount() {
  if (!supabase) throw new Error('Sign-in is temporarily unavailable.');
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut();
}

function storableMessages(messages: ChatMessageRecord[]): ChatMessageRecord[] {
  return messages.slice(-MAX_SAVED_MESSAGES).map((message) => ({
    role: message.role === 'ai' ? 'ai' : 'user',
    content: String(message.content ?? '').slice(0, MAX_STORED_MESSAGE_CHARS),
  }));
}

function asMode(value: unknown): MathDeskMode {
  return MODES.includes(value as MathDeskMode) ? (value as MathDeskMode) : 'solve';
}

/**
 * Saves one conversation. Every call re-checks that the account that started the chat is still the signed-in
 * account, so a chat can never be written under somebody else's id after an account switch.
 */
export async function saveConversation(expectedUserId: string, conversation: { id: string; title: string; mode: MathDeskMode; messages: ChatMessageRecord[] }) {
  if (!supabase || !UUID_PATTERN.test(conversation.id)) return;
  const userId = await currentUserId();
  if (!userId || userId !== expectedUserId || conversation.messages.length === 0) return;
  const { error } = await supabase.from('chat_conversations').upsert(
    {
      id: conversation.id,
      user_id: userId,
      title: conversation.title.slice(0, 80) || 'Conversation',
      mode: conversation.mode,
      messages: storableMessages(conversation.messages),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function loadConversations(expectedUserId: string): Promise<ConversationRecord[]> {
  if (!supabase) return [];
  const userId = await currentUserId();
  if (!userId || userId !== expectedUserId) return [];
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id,title,mode,messages,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? 'Conversation'),
    mode: asMode(row.mode),
    messages: Array.isArray(row.messages) ? (row.messages as ChatMessageRecord[]) : [],
    updated_at: row.updated_at as string | undefined,
  }));
}

export async function deleteConversation(expectedUserId: string, id: string) {
  if (!supabase || !UUID_PATTERN.test(id)) return;
  const userId = await currentUserId();
  if (!userId || userId !== expectedUserId) return;
  const { error } = await supabase.from('chat_conversations').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/** Reads the single-row history written by older builds, so it can be shown once and migrated. */
export async function loadLegacyHistory(expectedUserId: string): Promise<ChatMessageRecord[]> {
  if (!supabase) return [];
  const userId = await currentUserId();
  if (!userId || userId !== expectedUserId) return [];
  const { data, error } = await supabase.from('chat_history').select('messages').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const history = data?.messages as ChatMessageRecord[] | undefined;
  return Array.isArray(history) ? storableMessages(history) : [];
}

/** Everything MathDesk stores about the signed-in user, for the "download my data" button. */
export async function exportMyData() {
  if (!supabase) throw new Error('Sign-in is temporarily unavailable.');
  const user = await getCurrentUser();
  if (!user) throw new Error('Please sign in first.');
  const [conversations, lessons] = await Promise.all([
    supabase.from('chat_conversations').select('id,title,mode,messages,created_at,updated_at').eq('user_id', user.id),
    supabase.from('saved_lessons').select('id,title,content,source_type,created_at,updated_at').eq('user_id', user.id),
  ]);
  if (conversations.error) throw conversations.error;
  if (lessons.error) throw lessons.error;
  return {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, name: user.user_metadata?.name ?? null, created_at: user.created_at },
    conversations: conversations.data ?? [],
    saved_lessons: lessons.data ?? [],
  };
}
