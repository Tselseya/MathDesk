import { Moon, Sun } from 'lucide-react';
import { useRef } from 'react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const nextLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      ref={buttonRef}
      type="button"
      className="theme-toggle"
      onClick={() => toggleTheme(buttonRef.current)}
      aria-label={nextLabel}
      aria-pressed={theme === 'dark'}
      title={nextLabel}
    >
      {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
