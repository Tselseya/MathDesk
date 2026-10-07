import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getInitialTheme, nextTheme, parseStoredTheme, THEME_STORAGE_KEY, type Theme } from '../lib/theme';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: (origin?: HTMLElement | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<unknown> };
};

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage can be disabled in private browsing contexts.
  }
  return getInitialTheme(stored, window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Keep the theme usable when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const saved = parseStoredTheme(event.newValue);
      if (saved) setTheme(saved);
    };
    const onSystemChange = (event: MediaQueryListEvent) => {
      try {
        if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;
      } catch {
        // Fall through to the current system preference.
      }
      setTheme(event.matches ? 'dark' : 'light');
    };
    window.addEventListener('storage', onStorage);
    media.addEventListener('change', onSystemChange);
    root.dataset.theme = theme;
    return () => {
      window.removeEventListener('storage', onStorage);
      media.removeEventListener('change', onSystemChange);
    };
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    toggleTheme: (origin) => {
      const next = nextTheme(theme);
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || document.documentElement.dataset.motion === 'reduced';
      const viewDocument = document as ViewTransitionDocument;
      if (!reduceMotion && viewDocument.startViewTransition) {
        const bounds = origin?.getBoundingClientRect();
        const x = bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2;
        const y = bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2;
        const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        document.documentElement.style.setProperty('--theme-sweep-x', `${x}px`);
        document.documentElement.style.setProperty('--theme-sweep-y', `${y}px`);
        document.documentElement.style.setProperty('--theme-sweep-radius', `${radius}px`);
        document.documentElement.dataset.themeSweep = 'on';
        viewDocument.startViewTransition(() => setTheme(next)).finished.finally(() => {
          delete document.documentElement.dataset.themeSweep;
        });
        return;
      }
      setTheme(next);
    },
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
