import {
  currentUserId,
  saveConversation,
  supabase,
  type ChatMessageRecord,
} from './supabase';
import type { MathDeskMode } from '../types/ai';

const SHARE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export interface ShareableConversation {
  id: string;
  title: string;
  mode: MathDeskMode;
  messages: ChatMessageRecord[];
}

export interface ConversationShareStatus {
  active: boolean;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface SharedConversationSnapshot {
  title: string;
  mode: MathDeskMode;
  messages: Array<{ role: 'user' | 'ai'; content: string }>;
  expires_at: string;
}

function requireSupabase() {
  if (!supabase) throw new Error('Conversation sharing is temporarily unavailable.');
  return supabase;
}

async function requireExpectedUser(expectedUserId: string) {
  const userId = await currentUserId();
  if (!userId || userId !== expectedUserId) throw new Error('Please sign in again to manage this share link.');
}

export function createShareToken(): string {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashShareToken(token: string): Promise<string> {
  if (!SHARE_TOKEN_PATTERN.test(token)) throw new Error('This share link is not valid.');
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createConversationShare(
  expectedUserId: string,
  conversation: ShareableConversation,
): Promise<{ url: string; expiresAt: string }> {
  const client = requireSupabase();
  await requireExpectedUser(expectedUserId);
  if (conversation.messages.length === 0) throw new Error('Add at least one message before sharing.');

  // Persist the current in-memory state first. The database function then snapshots the saved row,
  // so the client cannot submit another user's transcript or inject attachments into a share.
  await saveConversation(expectedUserId, conversation);

  const token = createShareToken();
  const tokenHash = await hashShareToken(token);
  const { data, error } = await client.rpc('create_shared_conversation', {
    p_conversation_id: conversation.id,
    p_token_hash: tokenHash,
  });
  if (error) throw error;

  const result = data as { expires_at?: unknown } | null;
  if (!result || typeof result.expires_at !== 'string') {
    throw new Error('The share link could not be created. Check that the sharing migration has been applied.');
  }

  // The token stays in the URL fragment, which browsers do not send in HTTP requests or referrers.
  const shareUrl = new URL(window.location.pathname || '/', window.location.origin);
  shareUrl.hash = new URLSearchParams({ share: token }).toString();
  return { url: shareUrl.toString(), expiresAt: result.expires_at };
}

export async function getConversationShareStatus(
  expectedUserId: string,
  conversationId: string,
): Promise<ConversationShareStatus | null> {
  const client = requireSupabase();
  await requireExpectedUser(expectedUserId);
  const { data, error } = await client.rpc('get_my_conversation_share_status', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') return null;
  const result = data as Partial<ConversationShareStatus>;
  if (typeof result.active !== 'boolean' || typeof result.expires_at !== 'string') return null;
  return {
    active: result.active,
    created_at: typeof result.created_at === 'string' ? result.created_at : '',
    expires_at: result.expires_at,
    revoked_at: typeof result.revoked_at === 'string' ? result.revoked_at : null,
  };
}

export async function revokeConversationShare(expectedUserId: string, conversationId: string): Promise<boolean> {
  const client = requireSupabase();
  await requireExpectedUser(expectedUserId);
  const { data, error } = await client.rpc('revoke_shared_conversation', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return data === true;
}

export async function getSharedConversation(
  expectedUserId: string,
  token: string,
): Promise<SharedConversationSnapshot> {
  const client = requireSupabase();
  await requireExpectedUser(expectedUserId);
  const tokenHash = await hashShareToken(token);
  const { data, error } = await client.rpc('get_shared_conversation', {
    p_token_hash: tokenHash,
  });
  if (error || !data || typeof data !== 'object') {
    throw new Error('This share link is unavailable. It may have expired or been revoked.');
  }

  const result = data as Partial<SharedConversationSnapshot>;
  if (
    typeof result.title !== 'string'
    || typeof result.expires_at !== 'string'
    || !Array.isArray(result.messages)
  ) {
    throw new Error('This share link is unavailable. It may have expired or been revoked.');
  }

  const validModes: MathDeskMode[] = ['solve', 'learn', 'practice', 'deskbot'];
  const messages: SharedConversationSnapshot['messages'] = result.messages.flatMap((message) => {
    if (!message || typeof message !== 'object') return [];
    const row = message as { role?: unknown; content?: unknown };
    if ((row.role !== 'user' && row.role !== 'ai') || typeof row.content !== 'string') return [];
    return [{ role: row.role as 'user' | 'ai', content: row.content }];
  });

  return {
    title: result.title.slice(0, 80),
    mode: validModes.includes(result.mode as MathDeskMode) ? result.mode as MathDeskMode : 'solve',
    messages,
    expires_at: result.expires_at,
  };
}
