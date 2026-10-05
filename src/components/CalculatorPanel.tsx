import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Calculator, ChevronDown, Minus, X } from 'lucide-react';
import { formatAIReply } from '../lib/formatAIReply';
import { mathdeskAI } from '../services/mathdeskAI';

interface Keyboard { label: string; tabs: Record<string, string[]>; }

const keyboards: Record<string, Keyboard> = {
  basic: {
    label: 'Basic Math',
    tabs: {
      Numbers: ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '(', ')', '^'],
      Operations: ['+', '-', '×', '÷', '=', '%', '√', '|x|', '±'],
      Symbols: ['<', '>', '≤', '≥', '≠', '≈', '∞'],
    },
  },
  prealgebra: {
    label: 'Pre-Algebra',
    tabs: {
      Numbers: ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '(', ')', '^'],
      Algebra: ['x', 'y', '√', 'x²', 'x³', '|x|', '+', '-', '×', '÷', '='],
      Symbols: ['<', '>', '≤', '≥', '≠', '≈', '∞', '%'],
    },
  },
  algebra: {
    label: 'Algebra',
    tabs: {
      Basic: ['x', 'y', 'z', '+', '-', '×', '÷', '=', '(', ')', '^', '√', '7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'],
      Functions: ['f(x)', 'log', 'ln', 'eˣ', 'x²', 'x³', 'xⁿ', '√(x)', '∛(x)', '|x|', 'log₂', 'log₁₀'],
      Advanced: ['∈', '∉', '∩', '∪', '∅', '⊂', '⊃', '∀', '∃', '⇒', '⇔'],
    },
  },
  trig: {
    label: 'Trigonometry',
    tabs: {
      Basic: ['x', 'θ', '+', '-', '×', '÷', '=', '(', ')', '^', '7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'],
      Trig: ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'π', 'rad', '°'],
      Inverse: ['arcsin', 'arccos', 'arctan', 'arccot', 'arcsec', 'arccsc', 'sinh', 'cosh', 'tanh'],
    },
  },
  precalc: {
    label: 'Precalculus',
    tabs: {
      Basic: ['x', 'y', '+', '-', '×', '÷', '=', '(', ')', '^', '7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'],
      Functions: ['f(x)', 'g(x)', 'log', 'ln', 'eˣ', '√', 'x²', '∞', 'lim', '→'],
      Trig: ['sin', 'cos', 'tan', 'π', 'arcsin', 'arccos', 'arctan', '°'],
    },
  },
  calculus: {
    label: 'Calculus',
    tabs: {
      Basic: ['x', 'y', '+', '-', '×', '÷', '=', '(', ')', '^', '7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'],
      Calculus: ['∫', '∬', 'd/dx', '∂/∂x', 'lim', 'dx', 'dy', 'dt', '∑', '∏', '∞', '→'],
      Advanced: ['∇', 'Δ', '∂', '∮', '∯', 'eˣ', 'ln', 'log', '√', 'xⁿ'],
    },
  },
  stats: {
    label: 'Statistics',
    tabs: {
      Basic: ['x', 'y', '+', '-', '×', '÷', '=', '(', ')', '^', '7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'],
      Stats: ['μ', 'σ', 'x̄', 'σ²', 'Σ', 'n', 'P(x)', 'E(x)', '√', '!'],
      Probability: ['P', 'C', 'nPr', 'nCr', '!', '∩', '∪', '∅', '|', '~'],
    },
  },
  finitemath: {
    label: 'Finite Math',
    tabs: {
      Basic: ['x', 'y', '+', '-', '×', '÷', '=', '(', ')', '^', '7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'],
      Sets: ['∈', '∉', '⊂', '⊃', '∩', '∪', '∅', '∁', '×', '|A|'],
      Combinatorics: ['nPr', 'nCr', '!', '∑', 'n', 'k', 'P', 'C', '2ⁿ'],
    },
  },
  linalg: {
    label: 'Linear Algebra',
    tabs: {
      Basic: ['x', 'y', 'z', '+', '-', '×', '÷', '=', '(', ')', '^', '7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'],
      Vectors: ['v⃗', 'u⃗', '·', '×', '|v|', '∇', '∂', 'i', 'j', 'k'],
      Matrices: ['[A]', 'det', 'tr', 'Aᵀ', 'A⁻¹', 'I', '∈ℝ', 'rank', 'λ', '∑'],
    },
  },
};

/** Small, whitelisted arithmetic evaluator for the live preview line. Returns null when the input is not plain arithmetic. */
function evaluate(expression: string): string | null {
  if (!/[+\-×÷^%√]/.test(expression)) return null;
  const normalized = expression
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replaceAll('^', '**')
    .replace(/√\s*\(?([\d.]+)\)?/g, 'S($1)');
  if (!/^[\d\s+\-*/%().S]+$/.test(normalized) || !/\d/.test(normalized)) return null;
  try {
    const result = Function('S', `"use strict"; return (${normalized});`)(Math.sqrt);
    return typeof result === 'number' && Number.isFinite(result) ? String(Math.round(result * 1e10) / 1e10) : null;
  } catch {
    return null;
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

interface CalculatorPanelProps {
  onClose: () => void;
  /** Puts the expression into the chat input box. */
  onSendToChat?: (value: string) => void;
  /** "Also send to chat window": adds the problem and the AI answer to the conversation. */
  onAddToChat?: (problem: string, reply: string) => void;
  onOpenGraph?: () => void;
}

export default function CalculatorPanel({ onClose, onSendToChat, onAddToChat, onOpenGraph }: CalculatorPanelProps) {
  const [topic, setTopic] = useState('basic');
  const [tab, setTab] = useState('Numbers');
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [answerOpen, setAnswerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [alsoSendToChat, setAlsoSendToChat] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(true);
  const [position, setPosition] = useState(() => ({
    left: Math.max(8, Math.min(290, window.innerWidth - 336)),
    top: 80,
  }));
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const solveController = useRef<AbortController | null>(null);

  // Closing the calculator must not leave a request running in the background.
  useEffect(() => () => solveController.current?.abort(), []);

  const keyboard = keyboards[topic];
  const symbols = useMemo(() => keyboard.tabs[tab] ?? [], [keyboard, tab]);
  const preview = useMemo(() => evaluate(input), [input]);

  function chooseTopic(next: string) {
    setTopic(next);
    setTab(Object.keys(keyboards[next].tabs)[0]);
  }

  async function solve() {
    const problem = input.trim();
    if (!problem || busy) return;
    const controller = new AbortController();
    solveController.current = controller;
    setBusy(true);
    setAnswerOpen(true);
    setAnswer('');
    setError('');
    try {
      const reply = await mathdeskAI.solve(problem, {}, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setAnswer(formatAIReply(reply));
      if (alsoSendToChat) onAddToChat?.(problem, reply);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Could not reach the AI.');
    } finally {
      if (solveController.current === controller) solveController.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const solveRef = useRef(solve);
  const MAX_EXPRESSION = 500;
  solveRef.current = solve;

  // Physical keyboard support, like the legacy calculator (ignored while typing in a field).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      const { key } = event;
      if (/^[0-9.+\-()^]$/.test(key)) { event.preventDefault(); setInput((value) => (value + key).slice(0, MAX_EXPRESSION)); }
      else if (key === '*') { event.preventDefault(); setInput((value) => (value + '×').slice(0, MAX_EXPRESSION)); }
      else if (key === '/') { event.preventDefault(); setInput((value) => (value + '÷').slice(0, MAX_EXPRESSION)); }
      else if (key === 'Backspace') { event.preventDefault(); setInput((value) => value.slice(0, -1)); }
      else if (key === 'Enter' && tag !== 'BUTTON') { event.preventDefault(); void solveRef.current(); }
      else if (key === 'Escape') { event.preventDefault(); onClose(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('button')) return;
    dragOffset.current = { x: event.clientX - position.left, y: event.clientY - position.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const offset = dragOffset.current;
    if (!offset) return;
    setPosition({
      left: clamp(event.clientX - offset.x, 0, window.innerWidth - 120),
      top: clamp(event.clientY - offset.y, 64, window.innerHeight - 80),
    });
  }

  function endDrag() {
    dragOffset.current = null;
  }

  function clearAll() {
    setInput('');
    setAnswer('');
    setError('');
    setAnswerOpen(false);
  }

  return (
    <div className="lc-wrap" style={{ left: position.left, top: position.top }}>
      <section className="lc-window" role="dialog" aria-modal="false" aria-label="MathDesk Calculator">
        <header className="lc-header" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <div className="lc-title"><Calculator size={16} /> MathDesk Calculator</div>
          <div className="lc-controls">
            <button type="button" className="lc-ctrl" onClick={() => setTopicsOpen((open) => !open)} aria-label="Toggle subject panel" aria-expanded={topicsOpen}><Minus size={14} /></button>
            <button type="button" className="lc-ctrl lc-ctrl-close" onClick={onClose} aria-label="Close calculator"><X size={14} /></button>
          </div>
        </header>

        <div className={`lc-topics ${topicsOpen ? '' : 'collapsed'}`}>
          <button type="button" className="lc-topics-toggle" onClick={() => setTopicsOpen((open) => !open)}>Subject <ChevronDown size={14} /></button>
          <div className="lc-topic-scroll">
            {Object.entries(keyboards).map(([key, value]) => (
              <button type="button" key={key} className={`lc-topic ${topic === key ? 'active' : ''}`} onClick={() => chooseTopic(key)}>{value.label}</button>
            ))}
          </div>
        </div>

        <div className="lc-screen" aria-live="polite">
          <div className="lc-expr">{preview ? `= ${preview}` : ''}</div>
          <div className="lc-main">{input || '0'}<span className="lc-cursor" /></div>
        </div>

        <div className="lc-keyboard">
          <div className="lc-key-tabs">
            {Object.keys(keyboard.tabs).map((key) => (
              <button type="button" key={key} className={`lc-key-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{key}</button>
            ))}
          </div>
          <div className="lc-key-grid">
            <button type="button" className="lc-key lc-clear" onClick={clearAll}>C</button>
            <button type="button" className="lc-key lc-back" aria-label="Backspace" onClick={() => setInput((value) => value.slice(0, -1))}>⌫</button>
            <button type="button" className="lc-key lc-graph" onClick={onOpenGraph}>Graph</button>
            <button type="button" className="lc-key lc-solve" onClick={() => void solve()} disabled={busy}>{busy ? 'Solving…' : '▶ Solve'}</button>
            {symbols.map((symbol, index) => (
              <button
                type="button"
                key={`${symbol}-${index}`}
                className={`lc-key ${/^[+×÷=^-]$/.test(symbol) ? 'lc-operator' : ''}`}
                onClick={() => setInput((value) => (value + symbol).slice(0, MAX_EXPRESSION))}
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>

        <div className="lc-footer">
          <label className="lc-switch-row">
            <button type="button" role="switch" aria-checked={alsoSendToChat} aria-label="Also send to chat window" className={`lc-switch ${alsoSendToChat ? 'on' : ''}`} onClick={() => setAlsoSendToChat((on) => !on)} />
            Also send to chat window
          </label>
          <button type="button" className="lc-put" onClick={() => onSendToChat?.(input)} disabled={!input}>Put in chat box ↗</button>
        </div>
      </section>

      {answerOpen && (
        <aside className="lc-answer" aria-label="Solution">
          <header className="lc-answer-header">
            <h4>Solution</h4>
            <button type="button" onClick={() => setAnswerOpen(false)}>Close</button>
          </header>
          <div className="lc-answer-body">
            {busy && !answer && !error && <div className="lc-loading"><i /><i /><i /> Solving...</div>}
            {error && <p className="lc-error">{error}</p>}
            {answer && <div dangerouslySetInnerHTML={{ __html: answer }} />}
          </div>
        </aside>
      )}
    </div>
  );
}
