import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { purgeLegacyKeys, purgeUserData } from '../lib/localScope';

interface AuthUserState {
  /** False until the stored session has been read, so the UI never flashes the wrong identity. */
  ready: boolean;
  userId: string | null;
}

/**
 * The single source of truth for "who is using this browser right now".
 * Leaving an account (sign-out or switching to another one) purges that account's cached data;
 * the parent keys the workspace on userId, so all in-memory chat state resets at the same moment.
 */
export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>({ ready: !supabase, userId: null });
  const previous = useRef<string | null>(null);

  useEffect(() => {
    purgeLegacyKeys();
    if (!supabase) return undefined;
    let active = true;

    const apply = (nextId: string | null) => {
      if (!active) return;
      const before = previous.current;
      if (before && before !== nextId) purgeUserData(before);
      previous.current = nextId;
      setState((current) => (current.ready && current.userId === nextId ? current : { ready: true, userId: nextId }));
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id ?? null)).catch(() => apply(null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user.id ?? null));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
