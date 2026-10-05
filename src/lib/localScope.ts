/**
 * Everything MathDesk keeps in this browser is partitioned by "scope":
 * the signed-in user id, or "anon" when nobody is signed in. One person's drafts and lessons
 * are therefore never shown to, or uploaded for, the next person using the same browser.
 */
export type Scope = string;
export const ANON_SCOPE: Scope = 'anon';
export const scopeOf = (userId: string | null): Scope => userId ?? ANON_SCOPE;

const DRAFT_PREFIX = 'mathdesk:d:';
const LEGACY_DRAFT_PREFIX = 'mathdesk:draft:';
const LEGACY_LESSONS_KEY = 'mathdesk:saved-lessons';

export const draftKey = (scope: Scope, tabId: string) => `${DRAFT_PREFIX}${scope}:${tabId}`;
export const lessonsKey = (scope: Scope) => (scope === ANON_SCOPE ? LEGACY_LESSONS_KEY : `${LEGACY_LESSONS_KEY}:${scope}`);

function removeWhere(predicate: (key: string) => boolean) {
  try {
    const doomed: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && predicate(key)) doomed.push(key);
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Browser storage may be unavailable; nothing else to clean.
  }
}

/** Removes everything cached in this browser for one account (called when that account signs out). */
export function purgeUserData(userId: string) {
  removeWhere((key) => key === lessonsKey(userId) || key.startsWith(`${DRAFT_PREFIX}${userId}:`));
}

/** Old builds stored drafts without a scope; they may belong to any previous user. */
export function purgeLegacyKeys() {
  removeWhere((key) => key.startsWith(LEGACY_DRAFT_PREFIX));
}
