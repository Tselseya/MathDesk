import { useMemo, useState } from 'react';
import { Calculator, Eraser, Send, X } from 'lucide-react';
import { formatAIReply } from '../lib/formatAIReply';
import { mathdeskAI } from '../services/mathdeskAI';

const keyboards: Record<string, { label: string; tabs: Record<string, string[]> }> = {
  basic: { label: 'Basic Math', tabs: { Numbers: ['7','8','9','4','5','6','1','2','3','0','.','(',')','^'], Operations: ['+','-','×','÷','=','%','√','|x|','±'], Symbols: ['<','>','≤','≥','≠','≈','∞'] } },
  algebra: { label: 'Algebra', tabs: { Basic: ['x','y','z','+','-','×','÷','=','(',')','^','7','8','9','4','5','6','1','2','3','0','.'], Functions: ['f(x)','log','ln','eˣ','x²','x³','xⁿ','√(x)','|x|'], Advanced: ['∈','∉','∩','∪','∅','⊂','⊃','∀','∃'] } },
  calculus: { label: 'Calculus', tabs: { Basic: ['x','y','+','-','×','÷','=','(',')','^','7','8','9','4','5','6','1','2','3','0','.'], Calculus: ['∫','∬','d/dx','∂/∂x','lim','dx','dy','dt','∑','∞','→'], Advanced: ['∇','Δ','∂','∮','eˣ','ln','log','√','xⁿ'] } },
  stats: { label: 'Statistics', tabs: { Basic: ['x','y','+','-','×','÷','=','(',')','^','7','8','9','4','5','6','1','2','3','0','.'], Stats: ['μ','σ','x̄','σ²','Σ','n','P(x)','E(x)','√','!'], Probability: ['P','C','nPr','nCr','!','∩','∪','∅','|','~'] } },
};

function calculate(expression: string) {
  const normalized = expression.replaceAll('×', '*').replaceAll('÷', '/').replaceAll('^', '**').replace(/√\s*\(?([\d.]+)\)?/g, 'Math.sqrt($1)');
  if (!/^[\d\s+\-*/%().*]+$/.test(normalized) && !normalized.includes('Math.sqrt')) return 'Use numeric expressions for the local calculator, or send this to AI.';
  try { const result = Function(`"use strict"; return (${normalized})`)(); return Number.isFinite(result) ? String(result) : 'Cannot evaluate'; } catch { return 'Check the expression'; }
}

interface CalculatorPanelProps { onClose: () => void; onSendToChat?: (value: string) => void; }
export default function CalculatorPanel({ onClose, onSendToChat }: CalculatorPanelProps) {
  const [topic, setTopic] = useState('basic'); const [tab, setTab] = useState('Numbers'); const [input, setInput] = useState(''); const [answer, setAnswer] = useState(''); const [busy, setBusy] = useState(false);
  const keyboard = keyboards[topic]; const symbols = useMemo(() => keyboard.tabs[tab] ?? [], [keyboard, tab]);
  function chooseTopic(next: string) { setTopic(next); setTab(Object.keys(keyboards[next].tabs)[0]); }
  async function solveWithAI() { if (!input.trim()) return; setBusy(true); try { setAnswer(formatAIReply(await mathdeskAI.solve(input))); } catch (error) { setAnswer(`<p>${error instanceof Error ? error.message : 'Could not reach AI.'}</p>`); } finally { setBusy(false); } }
  return <div className="tool-modal-overlay"><section className="calculator-card" role="dialog" aria-modal="true" aria-labelledby="calculator-title"><header className="tool-modal-header"><div><span className="eyebrow"><Calculator size={14} /> Local calculator</span><h2 id="calculator-title">{keyboard.label}</h2></div><button className="tool-close" onClick={onClose} aria-label="Close calculator"><X size={18} /></button></header><div className="calc-topic-row">{Object.entries(keyboards).map(([key, value]) => <button className={topic === key ? 'active' : ''} key={key} onClick={() => chooseTopic(key)}>{value.label}</button>)}</div><div className="calc-screen" aria-live="polite"><small>{input || 'Ready when you are'}</small><strong>{input ? calculate(input) : '0'}</strong></div><div className="calc-tabs">{Object.keys(keyboard.tabs).map((key) => <button className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key)}>{key}</button>)}</div><div className="calc-keys"><button className="clear-key" onClick={() => { setInput(''); setAnswer(''); }}><Eraser size={15} /> Clear</button><button onClick={() => setInput((value) => value.slice(0, -1))}>⌫</button><button className="solve-key" onClick={solveWithAI} disabled={busy}><Send size={14} /> {busy ? 'Solving…' : 'Solve with AI'}</button>{symbols.map((symbol) => <button key={symbol} onClick={() => setInput((value) => value + symbol)}>{symbol}</button>)}</div>{answer && <div className="calc-answer" dangerouslySetInnerHTML={{ __html: answer }} />}{input && <button className="calc-chat-link" onClick={() => onSendToChat?.(input)}>Use this expression in chat ↗</button>}</section></div>;
}
