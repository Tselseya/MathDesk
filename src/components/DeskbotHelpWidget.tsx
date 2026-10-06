import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, MessageCircle, Send, X } from 'lucide-react';
import { mathdeskAI } from '../services/mathdeskAI';

type WidgetMessage = { role: 'user' | 'assistant'; content: string };

interface DeskbotHelpWidgetProps {
  onOpenChat: (initialPrompt?: string) => void;
  onUploadPhoto: () => void;
}

const starterMessage: WidgetMessage = {
  role: 'assistant',
  content: "Hi! I'm Desky. I can help you use MathDesk. What do you need?",
};

export default function DeskbotHelpWidget({ onOpenChat, onUploadPhoto }: DeskbotHelpWidgetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([starterMessage]);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, open]);

  async function sendMessage(value = draft) {
    const text = value.trim();
    if (!text || busy || !mathdeskAI.configured) return;
    const transcript = [...messages, { role: 'user' as const, content: text }];
    setMessages(transcript);
    setDraft('');
    setBusy(true);
    try {
      const reply = await mathdeskAI.askDesky(text, {}, { timeoutMs: 25000 });
      setMessages([...transcript, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([...transcript, {
        role: 'assistant',
        content: "I can't reach the MathDesk help service right now. Please try again later, or open the full AI Chatbox for math help.",
      }]);
    } finally {
      setBusy(false);
    }
  }

  function chooseQuickAction(action: 'solve' | 'upload' | 'free' | 'save') {
    if (action === 'solve') {
      onOpenChat();
      return;
    }
    if (action === 'upload') {
      onUploadPhoto();
      return;
    }
    if (action === 'free') void sendMessage('Is MathDesk free to use?');
    if (action === 'save') void sendMessage('How can I save my progress on MathDesk?');
  }

  return (
    <div className={`deskbot-widget ${open ? 'is-open' : ''}`}>
      {open && <section className="deskbot-panel" role="dialog" aria-modal="false" aria-labelledby="deskbot-title">
        <header className="deskbot-header">
          <span className="deskbot-avatar"><img src="/desky-mascot.webp" alt="" aria-hidden="true" /></span>
          <span className="deskbot-header-copy"><strong id="deskbot-title">Desky</strong><small>Your MathDesk guide</small></span>
          <span className="deskbot-header-indicator" aria-hidden="true" />
          <button type="button" className="deskbot-close" onClick={() => setOpen(false)} aria-label="Close Desky help"><X size={17} /></button>
        </header>

        <div className="deskbot-messages" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map((message, index) => (
            <article className={`deskbot-message ${message.role}`} key={`${index}-${message.role}`}>
              <p>{message.content}</p>
            </article>
          ))}
          {busy && <div className="deskbot-message assistant deskbot-thinking" role="status"><span /><span /><span /> Desky is thinking…</div>}
          <div className="deskbot-quick-actions" aria-label="Suggested help actions">
            <button type="button" onClick={() => chooseQuickAction('solve')}>Solve a problem</button>
            <button type="button" onClick={() => chooseQuickAction('upload')}>Upload a photo</button>
            <button type="button" onClick={() => chooseQuickAction('free')}>Is it free?</button>
            <button type="button" onClick={() => chooseQuickAction('save')}>Save my progress</button>
          </div>
          <div ref={endRef} />
        </div>

        <button
          type="button"
          className="deskbot-chat-link"
          onClick={() => onOpenChat([...messages].reverse().find((message) => message.role === 'user')?.content)}
        >
          Math question? Open the full AI Chatbox <ArrowUpRight size={14} />
        </button>
        <form className="deskbot-composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <label className="sr-only" htmlFor="deskbot-question">Ask Desky how to use MathDesk</label>
          <input
            id="deskbot-question"
            ref={inputRef}
            value={draft}
            maxLength={4000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask how to use MathDesk…"
            disabled={!mathdeskAI.configured || busy}
          />
          <button type="submit" aria-label="Send to Desky" disabled={!draft.trim() || busy || !mathdeskAI.configured}>
            <Send size={17} />
          </button>
        </form>
        <p className="deskbot-privacy-note">Help messages are sent to the AI service and are not saved to chat history. Don&apos;t share personal information.</p>
      </section>}

      <button
        type="button"
        className="deskbot-launcher"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Close Desky help' : 'Open Desky help'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={open ? 'Close Desky help' : 'Ask Desky for MathDesk help'}
      >
        {open ? <X size={21} /> : <><img src="/desky-mascot.webp" alt="" aria-hidden="true" /><MessageCircle className="deskbot-launcher-message" size={16} /></>}
      </button>
    </div>
  );
}
