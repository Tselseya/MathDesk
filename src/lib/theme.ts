export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'mathdesk:theme';

export function parseStoredTheme(value: string | null): Theme | null {
  return value === 'dark' || value === 'light' ? value : null;
}

export function getInitialTheme(storedValue: string | null, systemPrefersDark: boolean): Theme {
  return parseStoredTheme(storedValue) ?? (systemPrefersDark ? 'dark' : 'light');
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
