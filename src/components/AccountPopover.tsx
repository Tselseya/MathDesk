import { CircleHelp, ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface AccountPopoverProps {
  label: string;
  busy?: boolean;
  onOpenAccount: (section: 'profile' | 'settings') => void;
  onLogout: () => void;
}

export default function AccountPopover({ label, busy = false, onOpenAccount, onLogout }: AccountPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function choose(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <div className="account-menu" ref={containerRef}>
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Open account menu for ${label}`}
        title={label}
      >
        <span className="account-menu-avatar" aria-hidden="true"><UserRound size={15} /></span>
        <span className="account-menu-label">{label}</span>
        <ChevronDown className="account-menu-chevron" size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="account-popover" role="menu" aria-label="Account menu">
          <p className="account-popover-heading">{label}</p>
          <button type="button" role="menuitem" onClick={() => choose(() => onOpenAccount('profile'))}>
            <UserRound size={15} aria-hidden="true" /> Profile
          </button>
          <button type="button" role="menuitem" onClick={() => choose(() => onOpenAccount('settings'))}>
            <Settings size={15} aria-hidden="true" /> Settings
          </button>
          <a role="menuitem" href="mailto:chelseandrea99@gmail.com?subject=MathDesk%20help" onClick={() => setOpen(false)}>
            <CircleHelp size={15} aria-hidden="true" /> Help
          </a>
          <div className="account-popover-divider" />
          <button type="button" role="menuitem" onClick={() => choose(onLogout)} disabled={busy}>
            <LogOut size={15} aria-hidden="true" /> {busy ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      )}
    </div>
  );
}
