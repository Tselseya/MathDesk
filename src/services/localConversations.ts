import type { ChatMessageRecord, ConversationRecord } from './supabase';
import type { MathDeskMode } from '../types/ai';
import type { Scope } from '../lib/localScope';
import { MAX_SAVED_MESSAGES, MAX_STORED_MESSAGE_CHARS } from '../lib/limits';

const MODES: MathDeskMode[] = ['solve', 'learn', 'practice', 'deskbot'];
const MAX_CONVERSATIONS = 30;

export interface LocalConversation extends ConversationRecord { updated_at: string; }
export const localConversationsKey = (scope: Scope) => `mathdesk:local-conversations:${scope}`;

function sanitizeMessages(value: unknown): ChatMessageRecord[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_SAVED_MESSAGES).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const message = item as Record<string, unknown>;
    if ((message.role !== 'user' && message.role !== 'ai') || typeof message.content !== 'string') return [];
    return [{ role: message.role, content: message.content.slice(0, MAX_STORED_MESSAGE_CHARS) }];
  });
}
function sanitizeConversation(value: unknown): LocalConversation | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.title !== 'string') return null;
  const messages = sanitizeMessages(row.messages);
  if (!messages.length) return null;
  return {
    id: row.id, title: row.title.slice(0, 80) || 'Conversation',
    mode: MODES.includes(row.mode as MathDeskMode) ? row.mode as MathDeskMode : 'solve',
    messages, updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}
export function loadLocalConversations(scope: Scope): LocalConversation[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(localConversationsKey(scope)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeConversation).filter((item): item is LocalConversation => item !== null)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, MAX_CONVERSATIONS);
  } catch { return []; }
}
export function saveLocalConversation(scope: Scope, conversation: ConversationRecord): void {
  const safe = sanitizeConversation({ ...conversation, updated_at: new Date().toISOString() });
  if (!safe) return;
  const merged = [safe, ...loadLocalConversations(scope).filter((item) => item.id !== safe.id)]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, MAX_CONVERSATIONS);
  try { localStorage.setItem(localConversationsKey(scope), JSON.stringify(merged)); } catch { /* Storage is optional. */ }
}
export function deleteLocalConversation(scope: Scope, id: string): void {
  try { localStorage.setItem(localConversationsKey(scope), JSON.stringify(loadLocalConversations(scope).filter((item) => item.id !== id))); } catch { /* Storage is optional. */ }
}
export function exportLocalConversations(scope: Scope): LocalConversation[] { return loadLocalConversations(scope); }
export function importLocalConversations(scope: Scope, values: unknown): number {
  if (!Array.isArray(values)) throw new Error('The backup does not contain a conversation list.');
  const imported = values.map(sanitizeConversation).filter((item): item is LocalConversation => item !== null);
  const byId = new Map(loadLocalConversations(scope).map((item) => [item.id, item]));
  imported.forEach((item) => byId.set(item.id, item));
  const merged = [...byId.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, MAX_CONVERSATIONS);
  try { localStorage.setItem(localConversationsKey(scope), JSON.stringify(merged)); }
  catch { throw new Error('Browser storage is unavailable or full. Free some space and try again.'); }
  return imported.length;
}
