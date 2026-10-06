import { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, Share2 } from 'lucide-react';
import { formatAIReply } from '../lib/formatAIReply';
import { getSharedConversation, type SharedConversationSnapshot } from '../services/sharing';
import type { MathDeskMode } from '../types/ai';
import AuthPanel from './AuthPanel';

const PENDING_SHARE_KEY = 'mathdesk.pending-share-token';
const modeLabels: Record<MathDeskMode, string> = {
  solve: 'Solve',
  learn: 'Learn',
  practice: 'Practice',
  deskbot: 'Desky help',
};

interface SharedConversationPageProps {
  token: string;
  authReady: boolean;
  userId: string | null;
  onHome: () => void;
}

export default function SharedConversationPage({ token, authReady, userId, onHome }: SharedConversationPageProps) {
  const [snapshot, setSnapshot] = useState<SharedConversationSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!authReady || !token) return undefined;
    if (!userId) {
      try { sessionStorage.setItem(PENDING_SHARE_KEY, token); } catch { /* Session storage may be disabled. */ }
      setSnapshot(null);
      setLoading(false);
      setUnavailable(false);
      return undefined;
    }

    try { sessionStorage.removeItem(PENDING_SHARE_KEY); } catch { /* The viewer still works without session storage. */ }
    let active = true;
    setLoading(true);
    setUnavailable(false);
    getSharedConversation(userId, token)
      .then((result) => { if (active) setSnapshot(result); })
      .catch(() => { if (active) { setSnapshot(null); setUnavailable(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authReady, token, userId]);

  function leaveShare() {
    try { sessionStorage.removeItem(PENDING_SHARE_KEY); } catch { /* Ignore storage restrictions. */ }
    onHome();
  }

  const expiresLabel = snapshot ? new Date(snapshot.expires_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';

  return (
    <main className="shared-conversation-page">
      <header className="shared-page-header">
        <a className="shared-brand" href="/" onClick={(event) => { event.preventDefault(); leaveShare(); }}>
          <img src="/desky-mascot.webp" alt="" aria-hidden="true" />
          <span>Math<span>Desk</span></span>
        </a>
        <button type="button" className="shared-home-button" onClick={leaveShare}><ArrowLeft size={16} /> Back to MathDesk</button>
      </header>

      {!authReady ? <section className="shared-message-card" role="status">Checking your sign-in…</section> : !userId ? (
        <section className="shared-message-card shared-auth-card">
          <span className="shared-lock-icon"><LockKeyhole size={20} /></span>
          <p className="eyebrow">Private access</p>
          <h1>Sign in to view this conversation</h1>
          <p>This read-only snapshot is available only to signed-in MathDesk users with the link. MathDesk will try to restore the pending link after you sign in; if it does not, reopen the original link.</p>
          <AuthPanel compact />
        </section>
      ) : loading ? (
        <section className="shared-message-card" role="status">Loading shared snapshot…</section>
      ) : unavailable || !snapshot ? (
        <section className="shared-message-card shared-error-card" role="alert">
          <span className="shared-lock-icon"><LockKeyhole size={20} /></span>
          <h1>This share link is unavailable</h1>
          <p>It may have expired, been revoked, or been replaced by the owner.</p>
          <button type="button" className="share-create-button" onClick={leaveShare}>Return to MathDesk</button>
        </section>
      ) : (
        <article className="shared-transcript">
          <header className="shared-transcript-header">
            <div>
              <p className="eyebrow"><Share2 size={14} /> Read-only snapshot</p>
              <h1>{snapshot.title || 'Shared conversation'}</h1>
              <p className="shared-transcript-meta">{modeLabels[snapshot.mode]} · Link expires {expiresLabel} · Attachments excluded</p>
            </div>
            <span className="shared-readonly-badge">View only</span>
          </header>
          <div className="shared-transcript-messages">
            {snapshot.messages.map((message, index) => (
              <article className={`shared-message ${message.role}`} key={`${message.role}-${index}`}>
                <span className="shared-message-role">{message.role === 'user' ? 'You' : 'Desky'}</span>
                {message.role === 'ai'
                  ? <div className="shared-message-content" dangerouslySetInnerHTML={{ __html: formatAIReply(message.content) }} />
                  : <div className="shared-message-content"><p>{message.content}</p></div>}
              </article>
            ))}
          </div>
          <p className="shared-transcript-note">This is a snapshot. Messages added later are not included. The owner can revoke the link at any time.</p>
        </article>
      )}
      <footer className="shared-page-footer"><a href="/privacy.html">Privacy</a><span aria-hidden="true">·</span><a href="/terms.html">Terms</a></footer>
    </main>
  );
}
