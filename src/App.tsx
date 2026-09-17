import { useState } from 'react';
import { ArrowUpRight, GitBranch, Sparkles } from 'lucide-react';
import { mathdeskAI } from './services/mathdeskAI';
import type { MathDeskMode } from './types/ai';

const modes: Array<{ id: MathDeskMode; label: string; description: string }> = [
  { id: 'solve', label: 'Solve', description: 'Work through a problem step by step.' },
  { id: 'learn', label: 'Learn', description: 'Understand the idea behind the answer.' },
  { id: 'practice', label: 'Practice', description: 'Generate exercises at your pace.' },
];

export default function App() {
  const [mode, setMode] = useState<MathDeskMode>('solve');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('Adapter ready for local n8n.');

  async function tryAdapter() {
    if (!message.trim()) return;
    setStatus('Connecting to MathDesk AI…');
    try {
      const reply = await mathdeskAI.request({ message: message.trim(), mode });
      setStatus(`Connected. Received ${reply.length} characters from the workflow.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not reach MathDesk AI.');
    }
  }

  return (
    <main className="shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="MathDesk redesign home">
          <span className="brand-mark">∑</span>
          <span>Math<span>Desk</span></span>
        </a>
        <div className="topbar-actions">
          <span className="branch-pill">redesign / phase 1</span>
          <a className="icon-link" href="https://github.com/Tselseya/MathDesk" target="_blank" rel="noreferrer" aria-label="Open MathDesk on GitHub">
            <GitBranch size={18} />
          </a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={15} /> A calmer way to understand math</p>
          <h1>Ask. Learn.<br /><em>Understand.</em></h1>
          <p className="lede">The new MathDesk interface is being built as an installable learning workspace for students, tutors, and curious minds.</p>
        </div>

        <section className="workspace-card" aria-labelledby="workspace-title">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">Interactive workspace</p>
              <h2 id="workspace-title">Start with a learning mode</h2>
            </div>
            <span className="online-dot">● local adapter</span>
          </div>
          <div className="mode-grid" role="tablist" aria-label="Learning modes">
            {modes.map((item) => (
              <button className={`mode-card ${mode === item.id ? 'active' : ''}`} key={item.id} onClick={() => setMode(item.id)} role="tab" aria-selected={mode === item.id}>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
          <div className="prompt-row">
            <label className="sr-only" htmlFor="prompt">Math question</label>
            <textarea id="prompt" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Try: Explain why the derivative of x² is 2x" rows={2} />
            <button className="send-button" onClick={tryAdapter} aria-label="Send question"><ArrowUpRight size={21} /></button>
          </div>
          <p className="status" role="status">{status}</p>
        </section>
      </section>

      <footer className="footer"><span>Current stable app remains in <code>legacy/index.html</code> on this branch.</span><span>Phase 1 foundation only.</span></footer>
    </main>
  );
}
