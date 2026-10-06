import { useEffect, useState } from 'react';
import type { ShareableConversation } from '../services/sharing';
import {
  createConversationShare,
  getConversationShareStatus,
  revokeConversationShare,
  type ConversationShareStatus,
} from '../services/sharing';
import AuthPanel from './AuthPanel';
import { Copy, LoaderCircle, Share2, X } from 'lucide-react';

interface ShareConversationDialogProps {
  userId: string | null;
  conversation: ShareableConversation;
  onClose: () => void;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'in 30 days' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ShareConversationDialog({ userId, conversation, onClose }: ShareConversationDialogProps) {
  const [status, setStatus] = useState<ConversationShareStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(Boolean(userId));
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (!userId) {
      setStatusLoading(false);
      return undefined;
    }
    let active = true;
    setStatusLoading(true);
    getConversationShareStatus(userId, conversation.id)
      .then((next) => { if (active) setStatus(next); })
      .catch(() => { if (active) setNotice('Existing share status could not be checked. You can still generate a replacement link.'); })
      .finally(() => { if (active) setStatusLoading(false); });
    return () => { active = false; };
  }, [userId, conversation.id]);

  async function generateLink() {
    if (!userId || busy) return;
    setBusy(true);
    setNotice('');
    setCopied(false);
    try {
      const result = await createConversationShare(userId, conversation);
      setShareUrl(result.url);
      setStatus({ active: true, created_at: new Date().toISOString(), expires_at: result.expiresAt, revoked_at: null });
      setNotice('Link created. Anyone who opens it must sign in to MathDesk.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setNotice(message.includes('Conversation too large to share')
        ? 'This full conversation is too large to share as one snapshot. Try a shorter conversation.'
        : 'The link could not be created. Check your connection and confirm the conversation-sharing migration is installed.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeLink() {
    if (!userId || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const revoked = await revokeConversationShare(userId, conversation.id);
      setShareUrl('');
      setStatus((current) => current ? { ...current, active: false, revoked_at: new Date().toISOString() } : null);
      setNotice(revoked ? 'The link has been revoked and its stored snapshot was removed.' : 'There is no active share link to revoke.');
    } catch {
      setNotice('The link could not be revoked. Please try again when you are online.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setNotice('Share link copied.');
    } catch {
      setNotice('Copy was blocked by this browser. Select and copy the link from the field.');
    }
  }

  return (
    <div
      className="share-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" aria-describedby="share-dialog-description">
        <button type="button" className="share-dialog-close" onClick={onClose} aria-label="Close share dialog"><X size={18} /></button>
        <p className="eyebrow"><Share2 size={14} /> Conversation sharing</p>
        <h2 id="share-dialog-title">Share a snapshot</h2>
        <p id="share-dialog-description" className="share-dialog-description">
          The link opens a read-only snapshot for any signed-in MathDesk user. It expires after 30 days and you can revoke it sooner. Uploaded photos and files are not included; people with the link may copy or capture the text.
        </p>

        {!userId ? (
          <div className="share-auth-prompt">
            <p>Sign in to create or manage a share link.</p>
            <AuthPanel compact />
          </div>
        ) : <>
          {shareUrl && <div className="share-link-row">
            <label className="sr-only" htmlFor="share-link-value">Share link</label>
            <input id="share-link-value" value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
            <button type="button" onClick={() => void copyLink()} aria-label={copied ? 'Share link copied' : 'Copy share link'}><Copy size={16} />{copied ? 'Copied' : 'Copy'}</button>
          </div>}

          {statusLoading ? <p className="share-status-line" role="status"><LoaderCircle className="spin" size={15} /> Checking share status…</p> : status && !status.active && !status.revoked_at ? (
            <div className="share-existing-status">
              <p role="status">This link has expired. Its snapshot is still stored until you remove it or create a replacement.</p>
              <div className="share-actions">
                <button type="button" className="share-revoke-button" onClick={() => void revokeLink()} disabled={busy}>
                  {busy ? <LoaderCircle className="spin" size={16} /> : null} Remove expired snapshot
                </button>
              </div>
            </div>
          ) : status?.active ? (
            <div className="share-existing-status">
              <p role="status">An active link expires {dateLabel(status.expires_at)}. For privacy, its secret is not saved in this browser; generate a replacement to copy a new link.</p>
              <div className="share-actions">
                <button type="button" className="share-create-button" onClick={() => void generateLink()} disabled={busy}>
                  {busy ? <LoaderCircle className="spin" size={16} /> : <Share2 size={16} />} Generate replacement link
                </button>
                <button type="button" className="share-revoke-button" onClick={() => void revokeLink()} disabled={busy}>Revoke link</button>
              </div>
            </div>
          ) : (
            <button type="button" className="share-create-button" onClick={() => void generateLink()} disabled={busy || statusLoading}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Share2 size={16} />} Create share link
            </button>
          )}
        </>}

        {notice && <p className="share-notice" role="status" aria-live="polite">{notice}</p>}
      </section>
    </div>
  );
}
