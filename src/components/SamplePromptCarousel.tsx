import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { MathDeskMode } from '../types/ai';

type SamplePrompt = {
  label: string;
  prompt: string;
  mode: MathDeskMode;
  hint: string;
};

type SamplePromptCarouselProps = {
  onSelect: (mode: MathDeskMode, prompt: string) => void;
};

const samples: SamplePrompt[] = [
  {
    label: 'Algebra',
    prompt: 'Solve 2x + 5 = 17 and show each step.',
    mode: 'solve',
    hint: 'A linear equation, one clear step at a time.',
  },
  {
    label: 'Factorising',
    prompt: 'Explain why x² − 5x + 6 factors into (x − 2)(x − 3).',
    mode: 'learn',
    hint: 'Understand the pattern behind the factors.',
  },
  {
    label: 'Calculus',
    prompt: 'Find the derivative of 3x² − 4x + 1 and explain the power rule.',
    mode: 'learn',
    hint: 'Connect the rule to this example.',
  },
  {
    label: 'Graphs',
    prompt: 'How do I sketch y = |x − 2|? Describe the key points.',
    mode: 'learn',
    hint: 'Build the graph from its transformations.',
  },
  {
    label: 'Practice',
    prompt: 'Give me three practice questions on ratios, then wait for my answers.',
    mode: 'practice',
    hint: 'Get a short practice set at your pace.',
  },
];

type DragState = { pointerId: number; startX: number; startScroll: number; moved: boolean };

export default function SamplePromptCarousel({ onSelect }: SamplePromptCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickUntil = useRef(0);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      const track = trackRef.current;
      if (!drag || !track || event.pointerId !== drag.pointerId) return;
      const distance = event.clientX - drag.startX;
      if (Math.abs(distance) > 5) drag.moved = true;
      if (drag.moved) {
        event.preventDefault();
        track.scrollLeft = drag.startScroll - distance;
      }
    }

    function handlePointerUp(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.moved) suppressClickUntil.current = performance.now() + 280;
      dragRef.current = null;
      trackRef.current?.classList.remove('is-dragging');
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  function beginDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: event.currentTarget.scrollLeft,
      moved: false,
    };
  }

  function suppressDraggedClick(event: React.MouseEvent<HTMLDivElement>) {
    if (performance.now() >= suppressClickUntil.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function scrollTrack(direction: -1 | 1) {
    trackRef.current?.scrollBy({ left: direction * 270, behavior: 'smooth' });
  }

  return (
    <section className="sample-prompt-carousel reveal-on-scroll" aria-labelledby="sample-prompts-title">
      <div className="sample-carousel-heading">
        <div>
          <p className="eyebrow"><Sparkles size={14} /> A useful place to begin</p>
          <h2 id="sample-prompts-title">Try a sample problem</h2>
          <p>Choose a sample to open MathDesk AI and send it to Desky.</p>
        </div>
        <div className="sample-carousel-controls" aria-label="Carousel controls">
          <button type="button" onClick={() => scrollTrack(-1)} aria-label="Show previous sample prompts">
            <ChevronLeft size={17} />
          </button>
          <button type="button" onClick={() => scrollTrack(1)} aria-label="Show more sample prompts">
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div
        className="sample-prompt-track"
        ref={trackRef}
        role="group"
        aria-label="Sample math prompts; scroll or drag horizontally"
        onPointerDown={beginDrag}
        onClickCapture={suppressDraggedClick}
      >
        {samples.map((sample) => (
          <button
            className="sample-prompt-card"
            type="button"
            data-ripple
            key={sample.label}
            onClick={() => onSelect(sample.mode, sample.prompt)}
          >
            <span className="sample-prompt-label">{sample.label}</span>
            <span className="sample-prompt-text">{sample.prompt}</span>
            <span className="sample-prompt-hint">{sample.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
