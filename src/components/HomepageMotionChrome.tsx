import { useEffect, useRef } from 'react';

export default function HomepageMotionChrome() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.home-topbar');
    const shell = document.querySelector<HTMLElement>('.shell');
    let frameId = 0;

    function updateChrome() {
      frameId = 0;
      const scrollableHeight = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const progress = scrollableHeight > 0
        ? Math.min(1, Math.max(0, window.scrollY / scrollableHeight))
        : 0;
      header?.classList.toggle('is-compact', window.scrollY > 36);
      progressRef.current?.style.setProperty('--read-progress', String(progress));
      progressRef.current?.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      progressRef.current?.classList.toggle('has-progress', progress > 0.015);
    }

    function scheduleUpdate() {
      if (!frameId) frameId = window.requestAnimationFrame(updateChrome);
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 || !shell) return;
      const origin = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-ripple]')
        : null;
      if (!origin || !shell.contains(origin)) return;

      const bounds = origin.getBoundingClientRect();
      const scaleX = origin.offsetWidth > 0 ? bounds.width / origin.offsetWidth : 1;
      const scaleY = origin.offsetHeight > 0 ? bounds.height / origin.offsetHeight : 1;
      const ripple = document.createElement('span');
      ripple.className = 'math-click-ripple';
      ripple.style.left = `${(event.clientX - bounds.left) / scaleX}px`;
      ripple.style.top = `${(event.clientY - bounds.top) / scaleY}px`;
      origin.classList.add('math-ripple-host');
      origin.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 720);
    }

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    shell?.addEventListener('pointerdown', handlePointerDown, { passive: true });
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(document.body);
    scheduleUpdate();

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      shell?.removeEventListener('pointerdown', handlePointerDown);
      resizeObserver.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div
      className="reading-progress-rail"
      ref={progressRef}
      role="progressbar"
      aria-label="Homepage reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
    >
      <span className="reading-progress-track" aria-hidden="true">
        <span className="reading-progress-fill" />
        <span className="reading-progress-marker" />
      </span>
    </div>
  );
}
