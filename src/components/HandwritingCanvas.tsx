import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { base64Bytes, type PreparedImage } from '../lib/images';
import { MAX_ENCODED_IMAGE_BYTES } from '../lib/limits';

interface HandwritingCanvasProps {
  onClose: () => void;
  /** Adds the drawing to the chat as a pending image (fallback when onSolve is not given). */
  onUseImage: (image: PreparedImage) => void;
  /** Legacy behaviour: "Solve this" adds the drawing and sends it right away. */
  onSolve?: (image: PreparedImage) => void;
}

interface Stroke {
  tool: 'pen' | 'eraser';
  size: number;
  points: Array<[number, number]>;
}

const SIZES: Array<{ label: string; value: number }> = [
  { label: 'S', value: 2 },
  { label: 'M', value: 4 },
  { label: 'L', value: 6 },
];
const MAX_STROKES = 400;
const MAX_POINTS_PER_STROKE = 4000;
const INK = '#1a1a1a';

export default function HandwritingCanvas({ onClose, onUseImage, onSolve }: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cssSize = useRef({ width: 500, height: 400 });
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [size, setSize] = useState(4);
  const [penStrokes, setPenStrokes] = useState(0);
  const [message, setMessage] = useState('');
  const dialogRef = useDialogA11y<HTMLElement>(onClose);

  function paintStroke(context: CanvasRenderingContext2D, stroke: Stroke, fromIndex = 0) {
    const { points } = stroke;
    if (points.length === 0) return;
    context.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : INK;
    context.lineWidth = stroke.tool === 'eraser' ? stroke.size * 2.5 : stroke.size;
    context.beginPath();
    const start = Math.max(0, fromIndex - 1);
    context.moveTo(points[start][0], points[start][1]);
    if (points.length === 1) context.lineTo(points[0][0] + 0.01, points[0][1] + 0.01); // a tap leaves a dot
    for (let index = start + 1; index < points.length; index += 1) context.lineTo(points[index][0], points[index][1]);
    context.stroke();
  }

  function redraw() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, cssSize.current.width, cssSize.current.height);
    strokes.current.forEach((stroke) => paintStroke(context, stroke));
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    // Cap the pixel ratio: undo history is stored as vectors, but the export size still grows with it.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const available = (wrapperRef.current?.clientWidth ?? 500) - 32;
    const width = Math.max(160, Math.min(500, available));
    const height = Math.max(160, Math.min(400, Math.round(window.innerHeight * 0.45)));
    cssSize.current = { width, height };
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(ratio, ratio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    redraw();
  }, []);

  function pointFrom(event: ReactPointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = rect.width ? cssSize.current.width / rect.width : 1;
    const scaleY = rect.height ? cssSize.current.height / rect.height : 1;
    return [(event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY];
  }

  function startStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    if (strokes.current.length >= MAX_STROKES) { setMessage('That is a lot of strokes. Use Clear to start fresh.'); return; }
    setMessage('');
    event.currentTarget.setPointerCapture(event.pointerId);
    current.current = { tool, size, points: [pointFrom(event)] };
    const context = canvasRef.current?.getContext('2d');
    if (context) paintStroke(context, current.current);
  }

  function moveStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const stroke = current.current;
    if (!stroke) return;
    event.preventDefault();
    if (stroke.points.length >= MAX_POINTS_PER_STROKE) return;
    stroke.points.push(pointFrom(event));
    const context = canvasRef.current?.getContext('2d');
    if (context) paintStroke(context, stroke, stroke.points.length - 1);
  }

  function endStroke() {
    const stroke = current.current;
    current.current = null;
    if (!stroke) return;
    strokes.current.push(stroke);
    setPenStrokes(strokes.current.filter((item) => item.tool === 'pen').length);
  }

  function undo() {
    if (strokes.current.pop()) {
      setPenStrokes(strokes.current.filter((item) => item.tool === 'pen').length);
      redraw();
    }
  }

  function clear() {
    strokes.current = [];
    current.current = null;
    setPenStrokes(0);
    setMessage('');
    redraw();
  }

  /** Erasing everything also leaves nothing worth sending, so check the actual pixels. */
  function isBlank(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) return true;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] < 245 || data[index + 1] < 245 || data[index + 2] < 245) return false;
    }
    return true;
  }

  function solveDrawing() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (penStrokes === 0 || isBlank(canvas)) { setMessage('Write or draw your problem first.'); return; }
    let preview = canvas.toDataURL('image/png');
    let mimeType = 'image/png';
    if (base64Bytes(preview.split(',')[1] ?? '') > MAX_ENCODED_IMAGE_BYTES) {
      preview = canvas.toDataURL('image/jpeg', 0.9);
      mimeType = 'image/jpeg';
    }
    const data = preview.split(',')[1] ?? '';
    if (!data || base64Bytes(data) > MAX_ENCODED_IMAGE_BYTES) { setMessage('That drawing is too detailed to send. Clear and try a simpler one.'); return; }
    const image: PreparedImage = { mimeType, data, preview };
    (onSolve ?? onUseImage)(image);
    onClose();
  }

  return (
    <div className="lh-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className="lh-card" role="dialog" aria-modal="true" aria-label="Handwrite math">
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
            aria-label="Drawing area"
            onPointerDown={startStroke}
            onPointerMove={moveStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
          />
        </div>
        {message && <p className="lh-message" role="alert">{message}</p>}
        <div className="lh-bottom">
          <button type="button" className="lh-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="lh-solve" onClick={solveDrawing} disabled={penStrokes === 0}>Solve this ↗</button>
        </div>
      </section>
    </div>
  );
}
