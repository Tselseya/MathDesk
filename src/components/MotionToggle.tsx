import { Accessibility, Waves } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function MotionToggle() {
  const [reduced, setReduced] = useState(() => { try { return localStorage.getItem('mathdesk:reduce-motion') === 'true'; } catch { return false; } });
  useEffect(() => { document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'; try { localStorage.setItem('mathdesk:reduce-motion', String(reduced)); } catch { /* no-op */ } }, [reduced]);
  return <button className="motion-toggle" onClick={() => setReduced((value) => !value)} aria-pressed={reduced} title={reduced ? 'Turn animations on' : 'Reduce motion'}>{reduced ? <Accessibility size={15} /> : <Waves size={15} />}<span>{reduced ? 'Motion reduced' : 'Motion on'}</span></button>;
}
