import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
  radius: number;
  tone: number;
  phase: number;
};

type RGBColor = [number, number, number];

const MAX_PARTICLES = 190;
const TWO_PI = Math.PI * 2;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function readThemeColor(token: string, fallback: RGBColor): RGBColor {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none';
  probe.style.color = `var(${token}, rgb(${fallback.join(', ')}))`;
  document.body.appendChild(probe);
  const channels = window.getComputedStyle(probe).color.match(/[\d.]+/g);
  probe.remove();
  if (!channels || channels.length < 3) return fallback;
  return [Math.round(Number(channels[0])), Math.round(Number(channels[1])), Math.round(Number(channels[2]))];
}

function rgba(color: RGBColor, alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

export default function CursorParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return;

    const accentBlue = readThemeColor('--blue', [36, 89, 230]);
    const accentCyan = readThemeColor('--cyan', [8, 199, 233]);
    const particles: Particle[] = [];
    const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = window.innerWidth;
    let height = window.innerHeight;
    let pixelRatio = 1;
    let frameId = 0;
    let enabled = false;
    let hasPointer = false;
    let cursorX = 0;
    let cursorY = 0;
    let previousX = 0;
    let previousY = 0;
    let haloOpacity = 0;
    let clickAt = -1;
    let clickX = 0;
    let clickY = 0;
    let snapActive = false;
    let snapX = 0;
    let snapY = 0;

    function resizeCanvas() {
      const bounds = canvas!.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.round(width * pixelRatio);
      canvas!.height = Math.round(height * pixelRatio);
      context!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context!.clearRect(0, 0, width, height);
      if (bounds.width > 0 && bounds.height > 0) {
        previousX = cursorX;
        previousY = cursorY;
      }
    }

    function appendParticle(x: number, y: number, vx: number, vy: number, burst = false) {
      particles.push({
        x,
        y,
        vx,
        vy,
        age: 0,
        lifetime: burst ? 36 + Math.random() * 32 : 48 + Math.random() * 38,
        radius: burst ? 1.1 + Math.random() * 2.4 : 0.8 + Math.random() * 2.1,
        tone: Math.random(),
        phase: Math.random() * TWO_PI,
      });
      if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
    }

    function renderParticles(timestamp: number) {
      frameId = 0;
      context!.clearRect(0, 0, width, height);

      if (hasPointer && haloOpacity > 0.008) {
        const radius = snapActive ? 69 : 55;
        const halo = context!.createRadialGradient(cursorX, cursorY, 1, cursorX, cursorY, radius);
        halo.addColorStop(0, rgba(accentCyan, haloOpacity * 0.74));
        halo.addColorStop(0.35, rgba(accentBlue, haloOpacity * 0.34));
        halo.addColorStop(1, rgba(accentBlue, 0));
        context!.fillStyle = halo;
        context!.fillRect(cursorX - radius, cursorY - radius, radius * 2, radius * 2);
        haloOpacity *= 0.925;

        context!.beginPath();
        context!.arc(cursorX, cursorY, snapActive ? 7.5 : 5.5, 0, TWO_PI);
        context!.strokeStyle = rgba(accentBlue, snapActive ? 0.82 : 0.68);
        context!.lineWidth = 1.15;
        context!.stroke();
      }

      if (clickAt >= 0) {
        const age = timestamp - clickAt;
        if (age < 440) {
          const progress = age / 440;
          context!.beginPath();
          context!.arc(clickX, clickY, 4 + progress * 29, 0, TWO_PI);
          context!.strokeStyle = rgba(accentCyan, (1 - progress) * 0.56);
          context!.lineWidth = 1.2;
          context!.stroke();
        } else {
          clickAt = -1;
        }
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.age += 1;
        if (snapActive) {
          particle.vx += (snapX - particle.x) * 0.00048;
          particle.vy += (snapY - particle.y) * 0.00048;
        }
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.976;
        particle.vy *= 0.976;

        if (particle.age >= particle.lifetime) {
          particles.splice(index, 1);
          continue;
        }

        const life = 1 - particle.age / particle.lifetime;
        const flicker = 0.8 + Math.sin(timestamp * 0.008 + particle.phase) * 0.2;
        const opacity = life * flicker * (particle.tone > 0.72 ? 0.72 : 0.53);
        const color = particle.tone > 0.5
          ? rgba(accentCyan, opacity)
          : rgba(accentBlue, opacity);
        context!.beginPath();
        context!.arc(particle.x, particle.y, particle.radius * (0.6 + life * 0.55), 0, TWO_PI);
        context!.fillStyle = color;
        context!.fill();
      }

      if ((particles.length > 0 || haloOpacity > 0.008 || clickAt >= 0) && enabled) {
        frameId = window.requestAnimationFrame(renderParticles);
      }
    }

    function scheduleFrame() {
      if (enabled && !frameId) frameId = window.requestAnimationFrame(renderParticles);
    }

    function updateEnabledState() {
      const nextEnabled =
        pointerQuery.matches &&
        !reducedMotionQuery.matches &&
        document.documentElement.dataset.motion !== 'reduced';

      if (nextEnabled === enabled) return;
      enabled = nextEnabled;
      particles.length = 0;
      haloOpacity = 0;
      clickAt = -1;
      hasPointer = false;
      if (!enabled && frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
      context!.clearRect(0, 0, width, height);
    }

    function pointerCoordinates(event: PointerEvent) {
      const bounds = canvas!.getBoundingClientRect();
      const scaleX = bounds.width > 0 ? width / bounds.width : 1;
      const scaleY = bounds.height > 0 ? height / bounds.height : 1;
      return {
        x: (event.clientX - bounds.left) * scaleX,
        y: (event.clientY - bounds.top) * scaleY,
      };
    }

    function updateSnapTarget(event: PointerEvent) {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('a, button, [role="button"], [data-cursor="snap"]')
        : null;
      if (!target) {
        snapActive = false;
        return;
      }
      const bounds = target.getBoundingClientRect();
      snapX = bounds.left + bounds.width / 2;
      snapY = bounds.top + bounds.height / 2;
      snapActive = true;
    }

    function handlePointerMove(event: PointerEvent) {
      if (!enabled || (event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return;
      const point = pointerCoordinates(event);
      const distance = hasPointer ? Math.hypot(point.x - cursorX, point.y - cursorY) : 0;
      const deltaX = point.x - previousX;
      const deltaY = point.y - previousY;
      cursorX = point.x;
      cursorY = point.y;
      previousX = point.x;
      previousY = point.y;
      hasPointer = true;
      haloOpacity = Math.max(haloOpacity, 0.22);
      updateSnapTarget(event);

      const count = clamp(Math.ceil(distance / 10), 1, 4);
      for (let index = 0; index < count; index += 1) {
        const spread = 4 + Math.random() * 9;
        appendParticle(
          cursorX + (Math.random() - 0.5) * spread,
          cursorY + (Math.random() - 0.5) * spread,
          -deltaX * (0.018 + Math.random() * 0.026) + (Math.random() - 0.5) * 1.25,
          -deltaY * (0.018 + Math.random() * 0.026) + (Math.random() - 0.5) * 1.25,
        );
      }
      scheduleFrame();
    }

    function handlePointerDown(event: PointerEvent) {
      if (!enabled || (event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return;
      const point = pointerCoordinates(event);
      cursorX = point.x;
      cursorY = point.y;
      clickX = point.x;
      clickY = point.y;
      previousX = point.x;
      previousY = point.y;
      hasPointer = true;
      haloOpacity = 0.62;
      clickAt = performance.now();
      updateSnapTarget(event);

      for (let index = 0; index < 28; index += 1) {
        const angle = Math.random() * TWO_PI;
        const speed = 1.1 + Math.random() * 3.8;
        appendParticle(
          cursorX + (Math.random() - 0.5) * 7,
          cursorY + (Math.random() - 0.5) * 7,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          true,
        );
      }
      scheduleFrame();
    }

    resizeCanvas();
    updateEnabledState();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    pointerQuery.addEventListener('change', updateEnabledState);
    reducedMotionQuery.addEventListener('change', updateEnabledState);

    const motionObserver = new MutationObserver(updateEnabledState);
    motionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      pointerQuery.removeEventListener('change', updateEnabledState);
      reducedMotionQuery.removeEventListener('change', updateEnabledState);
      motionObserver.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="cursor-particle-field" aria-hidden="true" />;
}
