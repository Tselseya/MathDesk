import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, LogOut, UserPlus, X } from 'lucide-react';
import { getCurrentUser, onAuthChange, signIn, signOut, signUp, supabase, supabaseConfigured } from '../services/supabase';

interface AuthPanelProps { compact?: boolean; }

export default function AuthPanel({ compact = false }: AuthPanelProps) {
  const [open, setOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    const subscription = onAuthChange((_event, session) => {
      if (active) setUserLabel(session?.user?.user_metadata?.name || session?.user?.email || '');
    });
    return () => { active = false; subscription.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseConfigured) { setNotice('Sign-in is temporarily unavailable. Please try again later.'); return; }
    if (!email.trim() || !password || (signupMode && !name.trim())) {
      setNotice('Please complete all required fields.'); return;
    }
    if (signupMode && password.length < 6) {
      setNotice('Use a password with at least 6 characters.'); return;
    }
    setBusy(true); setNotice('');
    try {
      if (signupMode) {
        const { data, error } = await signUp(name.trim(), email.trim(), password);
        if (error) throw error;
        if (data.session) setOpen(false);
        else setNotice('Check your email to confirm your account, then log in.');
      } else {
        const { data, error } = await signIn(email.trim(), password);
        if (error) throw error;
        if (!data.session) throw new Error('No session was created. Please try again.');
        setOpen(false);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setNotice('');
    try {
      const { error } = await signOut();
      if (error) throw error;
      setUserLabel('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not log out. Please try again.');
    } finally { setBusy(false); }
  }

  async function googleLogin() {
    if (!supabase || !googleEnabled) {
      setNotice('Google sign-in is not available for this project yet.'); return;
    }
    setBusy(true); setNotice('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Google sign-in could not start.');
    } finally { setBusy(false); }
  }

  if (userLabel) return <><button className="auth-button signed-in" onClick={logout} disabled={busy}>
    <LogOut size={15} /> {compact ? 'Log out' : `${userLabel} · Log out`}
  </button>{notice && <span className="auth-inline-notice" role="alert">{notice}</span>}</>;

  const dialog = open ? <div className="auth-overlay" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) setOpen(false);
  }}>
    <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-description">
      <button type="button" className="auth-close" onClick={() => setOpen(false)} aria-label="Close sign-in dialog"><X size={18} /></button>
      <p className="eyebrow">Your MathDesk</p>
      <h2 id="auth-title">{signupMode ? 'Create an account' : 'Welcome back'}</h2>
      <p id="auth-description" className="auth-subtitle">{signupMode ? 'Save lessons and chat history across devices.' : 'Continue your saved learning sessions.'}</p>
      <form onSubmit={submit}>
        {signupMode && <label className="auth-label">Name<input ref={firstInputRef} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>}
        <label className="auth-label">Email<input ref={signupMode ? undefined : firstInputRef} value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>
        <label className="auth-label">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={signupMode ? 'new-password' : 'current-password'} minLength={signupMode ? 6 : undefined} required /></label>
        {notice && <p className="auth-notice" role="alert">{notice}</p>}
        <button type="submit" className="auth-submit" disabled={busy || !supabaseConfigured}>
          {signupMode ? <UserPlus size={16} /> : <LogIn size={16} />}{busy ? 'Working…' : signupMode ? 'Create account' : 'Log in'}
        </button>
      </form>
      {!supabaseConfigured && <p className="auth-provider-note" role="status">Sign-in is temporarily unavailable. Please try again later.</p>}
      <button type="button" className="auth-switch" onClick={() => { setSignupMode(!signupMode); setNotice(''); }}>
        {signupMode ? 'Already have an account? Log in' : 'Need an account? Sign up'}
      </button>
      <div className="auth-divider"><span>or continue with</span></div>
      <button type="button" className="auth-google" onClick={googleLogin} disabled={busy || !googleEnabled}>
        <span aria-hidden="true" className="auth-google-mark">G</span> Continue with Google
      </button>
      {!googleEnabled && <p className="auth-provider-note">Google sign-in is not available for this project yet. Use email instead.</p>}
    </section>
  </div> : null;

  return <><button ref={triggerRef} type="button" className="auth-button" onClick={() => { setOpen(true); setNotice(''); }}>
    <LogIn size={15} /> Log in / Sign up
  </button>{dialog && createPortal(dialog, document.body)}</>;
}
