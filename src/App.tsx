import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, GitBranch, Sparkles } from 'lucide-react';
import ChatWorkspace from './components/ChatWorkspace';
import type { MathDeskMode } from './types/ai';

const modes: Array<{ id: MathDeskMode; label: string; description: string }> = [
  { id: 'solve', label: 'Solve', description: 'Work through a problem step by step.' },
  { id: 'learn', label: 'Learn', description: 'Understand the idea behind the answer.' },
  { id: 'practice', label: 'Practice', description: 'Generate exercises at your pace.' },
];

export default function App() {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [mode, setMode] = useState<MathDeskMode>('solve');
  const [prompt, setPrompt] = useState('');

  function openWorkspace(nextMode: MathDeskMode, nextPrompt = '') {
    setMode(nextMode); setPrompt(nextPrompt); setWorkspaceOpen(true);
  }

  if (workspaceOpen) return <main className="app-shell"><nav className="topbar"><button className="back-link" onClick={() => setWorkspaceOpen(false)}><ArrowLeft size={17} /> Home</button><a className="brand" href="/" aria-label="MathDesk home"><span className="brand-mark">∑</span><span>Math<span>Desk</span></span></a><span className="branch-pill">redesign / phase 2</span></nav><ChatWorkspace initialMode={mode} initialPrompt={prompt} /></main>;

  return <main className="shell"><nav className="topbar"><a className="brand" href="/" aria-label="MathDesk redesign home"><span className="brand-mark">∑</span><span>Math<span>Desk</span></span></a><div className="topbar-actions"><span className="branch-pill">redesign / phase 2</span><a className="icon-link" href="https://github.com/Tselseya/MathDesk" target="_blank" rel="noreferrer" aria-label="Open MathDesk on GitHub"><GitBranch size={18} /></a></div></nav><section className="hero"><div className="hero-copy"><p className="eyebrow"><Sparkles size={15} /> A calmer way to understand math</p><h1>Ask. Learn.<br /><em>Understand.</em></h1><p className="lede">A learning workspace for students, tutors, and curious minds. Choose how you want to begin, then continue in the same MathDesk AI chatbox.</p></div><section className="workspace-card" aria-labelledby="workspace-title"><div className="workspace-heading"><div><p className="eyebrow">Interactive workspace</p><h2 id="workspace-title">Start with a learning mode</h2></div><span className="online-dot">● online AI</span></div><div className="mode-grid" role="tablist" aria-label="Learning modes">{modes.map((item) => <button className={`mode-card ${mode === item.id ? 'active' : ''}`} key={item.id} onClick={() => setMode(item.id)} role="tab" aria-selected={mode === item.id}><strong>{item.label}</strong><span>{item.description}</span></button>)}</div><div className="prompt-row"><label className="sr-only" htmlFor="prompt">Math question</label><textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Try: Explain why the derivative of x² is 2x" rows={2} /><button className="send-button" onClick={() => openWorkspace(mode, prompt)} aria-label="Open AI chatbox"><ArrowUpRight size={21} /></button></div><p className="status">Everything continues in the main AI chatbox, including uploads and saved history.</p><button className="workspace-link" onClick={() => openWorkspace(mode, prompt)}>Open full workspace <ArrowUpRight size={15} /></button></section></section><footer className="footer"><span>Connected chat foundation on <code>redesign</code>.</span><span>Phase 2 · n8n + Supabase preserved.</span></footer></main>;
}
