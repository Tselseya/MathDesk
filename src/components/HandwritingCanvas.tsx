import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MathDeskImage } from '../types/ai';

type DrawnImage = MathDeskImage & { preview: string };

interface HandwritingCanvasProps {
  onClose: () => void;
  /** Adds the drawing to the chat as a pending image (fallback when onSolve is not given). */
  onUseImage: (image: DrawnImage) => void;
  /** Legacy behaviour: "Solve this" adds the drawing and sends it right away. */
  onSolve?: (image: DrawnImage) => void;
}

const SIZES: Array<{ label: string; value: number }> = [
  { label: 'S', value: 2 },
  { label: 'M', value: 4 },
  { label: 'L', value: 6 },
];
const MAX_UNDO = 30;

export default function HandwritingCanvas({ onClose, onUseImage, onSolve }: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const undoStack = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [size, setSize] = useState(4);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(240, Math.min(500, (wrapperRef.current?.clientWidth ?? 500) - 32));
    const height = Math.max(200, Math.min(400, Math.round(window.innerHeight * 0.45)));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(ratio, ratio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function pointFrom(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    undoStack.current.push(context.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    drawing.current = true;
    const point = pointFrom(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
    // A single tap should leave a dot.
    context.strokeStyle = tool === 'eraser' ? '#ffffff' : '#1a1a1a';
    context.lineWidth = tool === 'eraser' ? size * 2.5 : size;
    context.lineTo(point.x + 0.01, point.y + 0.01);
    context.stroke();
    setHasInk(true);
  }

  function moveStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    event.preventDefault();
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const point = pointFrom(event);
    context.strokeStyle = tool === 'eraser' ? '#ffffff' : '#1a1a1a';
    context.lineWidth = tool === 'eraser' ? size * 2.5 : size;
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endStroke() {
    drawing.current = false;
  }

  function undo() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const previous = undoStack.current.pop();
    if (!canvas || !context || !previous) return;
    context.putImageData(previous, 0, 0);
    if (undoStack.current.length === 0) setHasInk(false);
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    undoStack.current = [];
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    setHasInk(false);
  }

  function solveDrawing() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    const preview = canvas.toDataURL('image/png');
    const image: DrawnImage = { mimeType: 'image/png', data: preview.split(',')[1], preview };
    (onSolve ?? onUseImage)(image);
    onClose();
  }

  return (
    <div className="lh-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="lh-card" role="dialog" aria-modal="true" aria-label="Handwrite math">
        <div className="lh-toolbar">
          <div className="lh-group">
            <button type="button" className={`lh-tool ${tool === 'pen' ? 'active' : ''}`} onClick={() => setTool('pen')}>Pen</button>
            <button type="button" className={`lh-tool ${tool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')}>Eraser</button>
          </div>
          <div className="lh-group">
            {SIZES.map((option) => (
              <button
                type="button"
                key={option.label}
                className={`lh-size ${size === option.value ? 'active' : ''}`}
                onClick={() => setSize(option.value)}
                aria-label={`Stroke size ${option.label}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="lh-group">
            <button type="button" className="lh-tool" onClick={undo}>Undo</button>
            <button type="button" className="lh-tool" onClick={clear}>Clear</button>
          </div>
        </div>
        <div className="lh-canvas-wrap" ref={wrapperRef}>
          <canvas
            ref={canvasRef}
            className="lh-canvas"
            onPointerDown={startStroke}
            onPointerMove={moveStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
          />
        </div>
        <div className="lh-bottom">
          <button type="button" className="lh-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="lh-solve" onClick={solveDrawing} disabled={!hasInk}>Solve this ↗</button>
        </div>
      </section>
    </div>
  );
}
