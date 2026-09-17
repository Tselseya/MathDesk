import { useEffect, useState } from 'react';

export function useLocalDraft(key: string, initialValue = '') {
  const [value, setValue] = useState(() => { try { return localStorage.getItem(key) ?? initialValue; } catch { return initialValue; } });
  useEffect(() => { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch { /* Local storage may be unavailable in private contexts. */ } }, [key, value]);
  function clear() { setValue(''); try { localStorage.removeItem(key); } catch { /* no-op */ } }
  return [value, setValue, clear] as const;
}
