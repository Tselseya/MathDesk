import { useEffect, useRef } from 'react';
import { isRippleTargetExcluded } from '../lib/homepageInteractions';

type Ripple = {
  x: number;
  y: number;
  startedAt: number;
  duration: number;
  maxRadius: number;
};

const MAX_RIPPLES = 6;
const RIPPLE_DURATION = 1250;
function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export default function BackgroundClickWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = canvas?.parentElement;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !shell || !context) return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const root = document.documentElement;
    const ripples: Ripple[] = [];
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frameId = 0;
    let enabled = !reducedMotionQuery.matches && root.dataset.motion !== 'reduced';
    let blueAccent = '#2459e6';
    let cyanAccent = '#08c7e9';

    function readAccentColors() {
      const styles = window.getComputedStyle(root);
      blueAccent = styles.getPropertyValue('--blue').trim() || blueAccent;
      cyanAccent = styles.getPropertyValue('--cyan').trim() || cyanAccent;
    }

    function resizeCanvas() {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      canvas!.width = Math.round(width * pixelRatio);
      canvas!.height = Math.round(height * pixelRatio);
      context!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function scheduleFrame() {
      if (enabled && ripples.length > 0 && !frameId) {
        frameId = window.requestAnimationFrame(drawFrame);
      }
    }

    function drawRing(ripple: Ripple, progress: number, color: string, strength: number) {
      if (progress <= 0 || progress >= 1) return;
      const radius = easeOutCubic(progress) * ripple.maxRadius;
      context!.globalAlpha = Math.pow(1 - progress, 1.55) * strength;
      context!.strokeStyle = color;
      context!.lineWidth = 1.35;
      context!.beginPath();
      context!.arc(ripple.x, ripple.y, Math.max(1, radius), 0, Math.PI * 2);
      context!.stroke();
    }

    function drawFrame(timestamp: number) {
      frameId = 0;
      context!.clearRect(0, 0, width, height);
      if (!enabled) {
        ripples.length = 0;
        return;
      }

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        const progress = clamp((timestamp - ripple.startedAt) / ripple.duration, 0, 1);
        if (progress >= 1) {
          ripples.splice(index, 1);
          continue;
        }

        drawRing(ripple, progress, blueAccent, 0.23);
        const trailingProgress = clamp((progress - 0.15) / 0.85, 0, 1);
        drawRing(ripple, trailingProgress, cyanAccent, 0.15);
      }

      context!.globalAlpha = 1;
      if (ripples.length > 0) frameId = window.requestAnimationFrame(drawFrame);
    }

    function handleBackgroundClick(event: MouseEvent) {
      if (!enabled || event.button !== 0 || event.detail === 0) return;
      const target = event.target;
      if (!(target instanceof Element) || !shell!.contains(target)) return;
      if (isRippleTargetExcluded(target)) return;

      ripples.push({
        x: event.clientX,
        y: event.clientY,
        startedAt: performance.now(),
        duration: RIPPLE_DURATION,
        maxRadius: Math.hypot(width, height) * 0.92,
      });
      if (ripples.length > MAX_RIPPLES) ripples.splice(0, ripples.length - MAX_RIPPLES);
      scheduleFrame();
    }

    function updateMotionPreference() {
      const nextEnabled = !reducedMotionQuery.matches && root.dataset.motion !== 'reduced';
      if (nextEnabled === enabled) return;
      enabled = nextEnabled;
      ripples.length = 0;
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      context!.clearRect(0, 0, width, height);
    }

    readAccentColors();
    resizeCanvas();
    shell.addEventListener('click', handleBackgroundClick);
    window.addEventListener('resize', resizeCanvas, { passive: true });
    reducedMotionQuery.addEventListener('change', updateMotionPreference);
    const motionObserver = new MutationObserver(updateMotionPreference);
    motionObserver.observe(root, { attributes: true, attributeFilter: ['data-motion'] });

    return () => {
      shell.removeEventListener('click', handleBackgroundClick);
      window.removeEventListener('resize', resizeCanvas);
      reducedMotionQuery.removeEventListener('change', updateMotionPreference);
      motionObserver.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="background-click-wave" aria-hidden="true" />;
}
