import { useEffect, useState } from 'react';
import { LogIn, LogOut, UserPlus, X } from 'lucide-react';
import { getCurrentUser, onAuthChange, signIn, signOut, signUp } from '../services/supabase';

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

  useEffect(() => {
    getCurrentUser().then((user) => setUserLabel(user?.user_metadata?.name || user?.email || '')).catch(() => undefined);
    const subscription = onAuthChange((_event, session) => setUserLabel(session?.user?.user_metadata?.name || session?.user?.email || ''));
    return () => subscription.data.subscription.unsubscribe();
  }, []);

  async function submit() {
    if (!email || !password || (signupMode && !name)) { setNotice('Please complete all required fields.'); return; }
    setBusy(true); setNotice('');
    try {
      if (signupMode) { await signUp(name, email, password); setNotice('Account created. Check your email if confirmation is enabled.'); }
      else { await signIn(email, password); setOpen(false); }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Authentication failed.'); }
    finally { setBusy(false); }
  }

  async function logout() { await signOut(); setUserLabel(''); }

  if (userLabel) return <button className="auth-button signed-in" onClick={logout}><LogOut size={15} /> {compact ? 'Log out' : `${userLabel} · Log out`}</button>;
  return <><button className="auth-button" onClick={() => { setOpen(true); setNotice(''); }}><LogIn size={15} /> Log in / Sign up</button>{open && <div className="auth-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-close" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button><p className="eyebrow">Your MathDesk</p><h2 id="auth-title">{signupMode ? 'Create an account' : 'Welcome back'}</h2><p className="auth-subtitle">{signupMode ? 'Save lessons and chat history across devices.' : 'Continue your saved learning sessions.'}</p>{signupMode && <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" autoComplete="name" /> }<input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" autoComplete="email" /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" autoComplete={signupMode ? 'new-password' : 'current-password'} />{notice && <p className="auth-notice" role="alert">{notice}</p>}<button className="auth-submit" onClick={submit} disabled={busy}>{signupMode ? <UserPlus size={16} /> : <LogIn size={16} />}{busy ? 'Working…' : signupMode ? 'Create account' : 'Log in'}</button><button className="auth-switch" onClick={() => { setSignupMode(!signupMode); setNotice(''); }}>{signupMode ? 'Already have an account? Log in' : 'Need an account? Sign up'}</button></section></div>}</>;
}
