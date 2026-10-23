import { afterEach, describe, expect, it, vi } from 'vitest';
import { purgeUserData } from './localScope';

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

describe('account-scoped local data cleanup', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('purges that account chat history, lessons, and drafts without touching guest or other-account data', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    storage.setItem('mathdesk:local-conversations:user-a', '[{"id":"private-chat"}]');
    storage.setItem('mathdesk:saved-lessons:user-a', '[{"title":"private lesson"}]');
    storage.setItem('mathdesk:d:user-a:tab-1', '{"draft":"private"}');
    storage.setItem('mathdesk:local-conversations:anon', '[{"id":"guest-chat"}]');
    storage.setItem('mathdesk:saved-lessons', '[{"title":"guest lesson"}]');
    storage.setItem('mathdesk:local-conversations:user-b', '[{"id":"other-user-chat"}]');
    storage.setItem('unrelated-preference', 'dark');

    purgeUserData('user-a');

    expect(storage.getItem('mathdesk:local-conversations:user-a')).toBeNull();
    expect(storage.getItem('mathdesk:saved-lessons:user-a')).toBeNull();
    expect(storage.getItem('mathdesk:d:user-a:tab-1')).toBeNull();
    expect(storage.getItem('mathdesk:local-conversations:anon')).not.toBeNull();
    expect(storage.getItem('mathdesk:saved-lessons')).not.toBeNull();
    expect(storage.getItem('mathdesk:local-conversations:user-b')).not.toBeNull();
    expect(storage.getItem('unrelated-preference')).toBe('dark');
  });
});
