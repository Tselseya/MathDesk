import { useEffect, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, LogIn, Paperclip, Send, UserRound, X } from 'lucide-react';
import { formatAIReply } from '../lib/formatAIReply';
import { mathdeskAI } from '../services/mathdeskAI';
import { loadChatHistory, saveChatHistory, type ChatMessageRecord } from '../services/supabase';
import type { MathDeskImage, MathDeskMode } from '../types/ai';

interface PendingImage extends MathDeskImage { preview: string; }
interface ChatWorkspaceProps { initialMode?: MathDeskMode; initialPrompt?: string; }

const placeholders: Record<MathDeskMode, string> = {
  solve: 'Type or paste a math problem…',
  learn: 'Paste your lesson or describe the concept…',
  practice: 'Enter a topic and I’ll make practice problems…',
  deskbot: 'Ask Desky how MathDesk works…',
};

export default function ChatWorkspace({ initialMode = 'solve', initialPrompt = '' }: ChatWorkspaceProps) {
  const [mode, setMode] = useState<MathDeskMode>(initialMode);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    loadChatHistory().then((saved) => { if (active && saved.length) setMessages(saved); }).catch(() => setNotice('Saved history could not be loaded. Local chat still works.'));
    return () => { active = false; };
  }, []);

  function addFiles(files: FileList | File[]) {
    Array.from(files).filter((file) => file.type.startsWith('image/')).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const [, data] = dataUrl.split(',');
        setPendingImages((current) => [...current, { mimeType: file.type, data, preview: dataUrl }]);
      };
      reader.readAsDataURL(file);
    });
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const image = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'))?.getAsFile();
    if (image) { event.preventDefault(); addFiles([image]); }
  }

  async function send() {
    const text = prompt.trim();
    if (!text && pendingImages.length === 0) return;
    const userMessage: ChatMessageRecord = { role: 'user', content: text || 'Solve this problem from the uploaded image.', imagePreviews: pendingImages.map((image) => image.preview) };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages); setPrompt(''); setPendingImages([]); setBusy(true); setNotice('');
    try {
      const reply = await mathdeskAI.request({ message: userMessage.content, mode, ...(userMessage.imagePreviews?.length ? { hasImages: true, images: pendingImages.map(({ preview: _preview, ...image }) => image) } : {}) });
      const updated = [...nextMessages, { role: 'ai' as const, content: reply }];
      setMessages(updated);
      await saveChatHistory(updated);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not reach MathDesk AI.');
    } finally { setBusy(false); }
  }

  return <section className="chat-workspace" aria-label="MathDesk AI chatbox">
    <aside className="chat-rail">
      <div className="chat-rail-title"><span className="desky-dot">∑</span><div><strong>MathDesk AI</strong><small>Learn one step at a time</small></div></div>
      <div className="chat-modes" role="tablist" aria-label="AI modes">
        {(['solve', 'learn', 'practice'] as MathDeskMode[]).map((item) => <button key={item} className={mode === item ? 'selected' : ''} onClick={() => setMode(item)} role="tab" aria-selected={mode === item}>{item === 'solve' ? '⌕' : item === 'learn' ? '▱' : '✎'}<span>{item[0].toUpperCase() + item.slice(1)}</span></button>)}
      </div>
      <p className="chat-rail-note">Your requests use the existing n8n workflow. New AI responses require an internet connection.</p>
    </aside>
    <div className="chat-panel">
      <header className="chat-panel-header"><div><span className="eyebrow">{mode} mode</span><h2>{mode === 'solve' ? 'Solve with explanation' : mode === 'learn' ? 'Learn a concept' : 'Practice with purpose'}</h2></div><span className="chat-status"><span /> online AI</span></header>
      <div className="messages" aria-live="polite">
        {messages.length === 0 && <div className="chat-empty"><span className="empty-symbol">∫</span><h3>What are you working on?</h3><p>Type a question, upload a problem, or paste an image to begin.</p></div>}
        {messages.map((message, index) => <article className={`message-bubble ${message.role}`} key={`${message.role}-${index}`}>
          <div className="message-avatar">{message.role === 'ai' ? '∑' : <UserRound size={15} />}</div>
          <div className="message-content">{message.imagePreviews?.map((preview) => <img className="message-image" src={preview} alt="Uploaded math problem" key={preview} />)}{message.role === 'ai' ? <div dangerouslySetInnerHTML={{ __html: formatAIReply(message.content) }} /> : <p>{message.content}</p>}</div>
        </article>)}
        {busy && <div className="message-bubble ai"><div className="message-avatar">∑</div><div className="typing"><i /><i /><i /><span>Desky is thinking…</span></div></div>}
      </div>
      {notice && <p className="chat-notice" role="alert">{notice}</p>}
      <div className="composer">
        {pendingImages.length > 0 && <div className="pending-images">{pendingImages.map((image, index) => <div className="pending-image" key={image.preview}><img src={image.preview} alt="Pending upload" /><button onClick={() => setPendingImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove image"><X size={13} /></button></div>)}</div>}
        <textarea ref={textareaRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} onPaste={handlePaste} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send(); }} placeholder={placeholders[mode]} rows={3} disabled={busy} />
        <div className="composer-actions"><button onClick={() => fileInputRef.current?.click()} title="Upload an image"><Paperclip size={17} /> Upload</button><button onClick={() => fileInputRef.current?.click()} title="Take or upload a photo"><ImagePlus size={17} /> Photo</button><input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} /><span>Ctrl/⌘ + Enter to send</span><button className="send-chat" onClick={send} disabled={busy || (!prompt.trim() && pendingImages.length === 0)}>{busy ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}<span>Send</span></button></div>
      </div>
    </div>
  </section>;
}
