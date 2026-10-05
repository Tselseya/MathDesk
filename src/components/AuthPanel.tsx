import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Download, LogIn, LogOut, Trash2, UserPlus, X } from 'lucide-react';
import {
  deleteMyAccount,
  exportMyData,
  getCurrentUser,
  onAuthChange,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  supabase,
  supabaseConfigured,
  updatePassword,
} from '../services/supabase';

interface AuthPanelProps { compact?: boolean; }
type Mode = 'login' | 'signup' | 'forgot' | 'recovery' | 'account';

const MIN_PASSWORD = 8;

function friendlyAuthError(error: unknown, context: 'login' | 'signup' | 'update'): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const status = (error as { status?: number } | null)?.status;
  if (status === 429 || message.includes('rate limit') || message.includes('too many')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (message.includes('failed to fetch') || message.includes('network')) return 'Could not reach the sign-in service. Check your connection and try again.';
  if (context === 'login') {
    if (message.includes('not confirmed')) return 'Please confirm your email first. Check your inbox for the confirmation link.';
    return 'That email and password do not match.';
  }
  if (context === 'signup') return `We could not create that account. If you already have one, log in or reset your password. Passwords need at least ${MIN_PASSWORD} characters.`;
  return 'Could not update the password. The reset link may have expired, so request a new one.';
}

export default function AuthPanel({ compact = false }: AuthPanelProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const [userLabel, setUserLabel] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    getCurrentUser().then((user) => {
      if (active) setUserLabel(user?.user_metadata?.name || user?.email || '');
    }).catch(() => undefined);
    const subscription = onAuthChange((event, session) => {
      if (!active) return;
      setUserLabel(session?.user?.user_metadata?.name || session?.user?.email || '');
      if (event === 'PASSWORD_RECOVERY') { setMode('recovery'); setNotice(''); setOpen(true); }
    });
    return () => { active = false; subscription.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '' },
    }).then((response) => {
      if (!response.ok) throw new Error('Provider settings are unavailable.');
      return response.json();
    }).then((settings) => {
      if (active) setGoogleEnabled(settings.external?.google === true);
    }).catch(() => { if (active) setGoogleEnabled(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => firstInputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  function switchMode(next: Mode) {
    setMode(next);
    setNotice('');
    setPassword('');
    setConfirm('');
    setDeleteText('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseConfigured) { setNotice('Sign-in is temporarily unavailable. Please try again later.'); return; }

    if (mode === 'forgot') {
      if (!email.trim()) { setNotice('Enter the email you signed up with.'); return; }
      setBusy(true); setNotice('');
      try { await requestPasswordReset(email.trim()); } catch { /* Same message either way, so accounts cannot be probed. */ }
      setNotice('If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.');
      setBusy(false);
      return;
    }

    if (mode === 'recovery') {
      if (password.length < MIN_PASSWORD) { setNotice(`Use a password with at least ${MIN_PASSWORD} characters.`); return; }
      if (password !== confirm) { setNotice('The two passwords do not match.'); return; }
      setBusy(true); setNotice('');
      try {
        const { error } = await updatePassword(password);
        if (error) throw error;
        setOpen(false);
        setMode('login');
        setPassword('');
        setConfirm('');
      } catch (error) {
        setNotice(friendlyAuthError(error, 'update'));
      } finally { setBusy(false); }
      return;
    }

    if (!email.trim() || !password || (mode === 'signup' && !name.trim())) {
      setNotice('Please complete all required fields.'); return;
    }
    if (mode === 'signup' && password.length < MIN_PASSWORD) {
      setNotice(`Use a password with at least ${MIN_PASSWORD} characters.`); return;
    }
    setBusy(true); setNotice('');
    try {
      if (mode === 'signup') {
        const { data, error } = await signUp(name.trim(), email.trim(), password);
        if (error) throw error;
        if (data.session) setOpen(false);
        else setNotice('Check your email to confirm your account, then log in.');
      } else {
        const { data, error } = await signIn(email.trim(), password);
        if (error) throw error;
        if (!data.session) throw new Error('No session was created.');
        setOpen(false);
      }
      setPassword('');
    } catch (error) {
      setNotice(friendlyAuthError(error, mode === 'signup' ? 'signup' : 'login'));
    } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setNotice('');
    try {
      const { error } = await signOut();
      if (error) throw error;
      setUserLabel('');
      setOpen(false);
    } catch {
      setNotice('Could not log out. Please try again.');
    } finally { setBusy(false); }
  }

  async function googleLogin() {
    if (!supabase || !googleEnabled) {
      setNotice('Google sign-in is not available for this project yet.'); return;
    }
    setBusy(true); setNotice('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch {
      setNotice('Google sign-in could not start. Please use email instead.');
    } finally { setBusy(false); }
  }

  async function downloadData() {
    setBusy(true); setNotice('');
    try {
      const data = await exportMyData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mathdesk-my-data.json';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Your data was downloaded as mathdesk-my-data.json.');
    } catch {
      setNotice('Could not export your data right now. Please try again.');
    } finally { setBusy(false); }
  }

  async function removeAccount() {
    if (deleteText.trim().toUpperCase() !== 'DELETE') { setNotice('Type DELETE to confirm.'); return; }
    setBusy(true); setNotice('');
    try {
      await deleteMyAccount();
      setUserLabel('');
      setOpen(false);
    } catch {
      setNotice('Could not delete the account right now. Please try again or email us.');
    } finally { setBusy(false); }
  }

  const titles: Record<Mode, string> = {
    login: 'Welcome back',
    signup: 'Create an account',
    forgot: 'Reset your password',
    recovery: 'Choose a new password',
    account: 'Your account',
  };
  const subtitles: Record<Mode, string> = {
    login: 'Continue your saved learning sessions.',
    signup: 'Save lessons and chat history across devices.',
    forgot: 'We will email you a link to set a new password.',
    recovery: `Use at least ${MIN_PASSWORD} characters.`,
    account: userLabel,
  };

  const dialog = open ? <div className="auth-overlay" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && mode !== 'recovery') setOpen(false);
  }}>
    <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-description">
      <button type="button" className="auth-close" onClick={() => setOpen(false)} aria-label="Close dialog"><X size={18} /></button>
      <p className="eyebrow">Your MathDesk</p>
      <h2 id="auth-title">{titles[mode]}</h2>
      <p id="auth-description" className="auth-subtitle">{subtitles[mode]}</p>

      {mode === 'account' ? <div className="auth-account">
        <button type="button" className="auth-secondary" onClick={() => void downloadData()} disabled={busy}><Download size={15} /> Download my data</button>
        <div className="auth-danger-zone">
          <p><strong>Delete my account</strong><br />This permanently removes your account, saved chats and saved lessons. It cannot be undone.</p>
          <label className="auth-label">Type DELETE to confirm<input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} autoComplete="off" /></label>
          <button type="button" className="auth-danger" onClick={() => void removeAccount()} disabled={busy || deleteText.trim().toUpperCase() !== 'DELETE'}><Trash2 size={15} /> Delete my account</button>
        </div>
        {notice && <p className="auth-notice" role="alert">{notice}</p>}
      </div> : <form onSubmit={submit}>
        {mode === 'signup' && <label className="auth-label">Name<input ref={firstInputRef} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>}
        {(mode === 'login' || mode === 'signup' || mode === 'forgot') && <label className="auth-label">Email<input ref={mode === 'signup' ? undefined : firstInputRef} value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>}
        {(mode === 'login' || mode === 'signup' || mode === 'recovery') && <label className="auth-label">{mode === 'recovery' ? 'New password' : 'Password'}<input ref={mode === 'recovery' ? firstInputRef : undefined} value={password} maxLength={128} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : MIN_PASSWORD} required /></label>}
        {mode === 'recovery' && <label className="auth-label">Confirm new password<input value={confirm} maxLength={128} onChange={(event) => setConfirm(event.target.value)} type="password" autoComplete="new-password" minLength={MIN_PASSWORD} required /></label>}
        {notice && <p className="auth-notice" role="alert">{notice}</p>}
        <button type="submit" className="auth-submit" disabled={busy || !supabaseConfigured}>
          {mode === 'signup' ? <UserPlus size={16} /> : <LogIn size={16} />}
          {busy ? 'Working…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'recovery' ? 'Save new password' : 'Log in'}
        </button>
        {mode === 'login' && <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>Forgot your password?</button>}
        {mode === 'signup' && <p className="auth-legal">By creating an account you agree to the <a href="./terms.html" target="_blank" rel="noopener noreferrer">Terms</a> and <a href="./privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>}
      </form>}

      {mode !== 'account' && !supabaseConfigured && <p className="auth-provider-note" role="status">Sign-in is temporarily unavailable. Please try again later.</p>}
      {(mode === 'login' || mode === 'signup' || mode === 'forgot') && <button type="button" className="auth-switch" onClick={() => switchMode(mode === 'signup' || mode === 'forgot' ? 'login' : 'signup')}>
        {mode === 'signup' ? 'Already have an account? Log in' : mode === 'forgot' ? 'Back to log in' : 'Need an account? Sign up'}
      </button>}
      {(mode === 'login' || mode === 'signup') && <>
        <div className="auth-divider"><span>or continue with</span></div>
        <button type="button" className="auth-google" onClick={googleLogin} disabled={busy || !googleEnabled}>
          <span aria-hidden="true" className="auth-google-mark">G</span> Continue with Google
        </button>
        {!googleEnabled && <p className="auth-provider-note">Google sign-in is not available for this project yet. Use email instead.</p>}
      </>}
    </section>
  </div> : null;

  if (userLabel) return <>
    <button type="button" className={`auth-session${compact ? ' compact' : ''}`} title={`${userLabel}: account settings`} onClick={() => { switchMode('account'); setOpen(true); }}>Signed in as {userLabel}</button>
    <button type="button" className="auth-button signed-in" onClick={logout} disabled={busy} aria-label="Sign out of MathDesk">
      <LogOut size={15} /> {busy ? 'Signing out…' : 'Sign out'}
    </button>
    {notice && !open && <span className="auth-inline-notice" role="alert">{notice}</span>}
    {dialog && createPortal(dialog, document.body)}
  </>;

  return <><button ref={triggerRef} type="button" className="auth-button" onClick={() => { switchMode('login'); setOpen(true); }}>
    <LogIn size={15} /> Log in / Sign up
  </button>{dialog && createPortal(dialog, document.body)}</>;
}
