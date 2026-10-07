import { describe, expect, it } from 'vitest';
import { getInitialTheme, nextTheme, parseStoredTheme, THEME_STORAGE_KEY } from './theme';

describe('MathDesk theme preference', () => {
  it('uses the saved preference before the system preference', () => {
    expect(getInitialTheme('dark', false)).toBe('dark');
    expect(getInitialTheme('light', true)).toBe('light');
  });

  it('follows the system preference when no saved preference exists', () => {
    expect(getInitialTheme(null, true)).toBe('dark');
    expect(getInitialTheme('invalid', false)).toBe('light');
  });

  it('parses only supported stored values and toggles them', () => {
    expect(parseStoredTheme('dark')).toBe('dark');
    expect(parseStoredTheme('light')).toBe('light');
    expect(parseStoredTheme('system')).toBeNull();
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
    expect(THEME_STORAGE_KEY).toBe('mathdesk:theme');
  });
});
