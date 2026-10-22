import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteLocalConversation, importLocalConversations, loadLocalConversations, saveLocalConversation } from './localConversations';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

describe('local conversation history', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('persists only text transcript and reloads it from the selected scope', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    saveLocalConversation('anon', {
      id: 'chat-1', title: 'Algebra', mode: 'solve',
      messages: [{ role: 'user', content: 'x + 1 = 2', imagePreviews: ['data:image/png;base64,secret'] }, { role: 'ai', content: 'x = 1' }],
    });
    expect(loadLocalConversations('anon')).toMatchObject([{ id: 'chat-1', title: 'Algebra', messages: [{ role: 'user', content: 'x + 1 = 2' }, { role: 'ai', content: 'x = 1' }] }]);
    expect(loadLocalConversations('other-user')).toEqual([]);
  });

  it('merges imported chats and supports deletion without clearing unrelated chats', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    saveLocalConversation('anon', { id: 'keep', title: 'Keep', mode: 'learn', messages: [{ role: 'user', content: 'Keep this' }] });
    expect(importLocalConversations('anon', [{ id: 'imported', title: 'Imported', mode: 'practice', messages: [{ role: 'ai', content: 'New item' }] }])).toBe(1);
    expect(loadLocalConversations('anon').map((chat) => chat.id).sort()).toEqual(['imported', 'keep']);
    deleteLocalConversation('anon', 'imported');
    expect(loadLocalConversations('anon').map((chat) => chat.id)).toEqual(['keep']);
  });
});
