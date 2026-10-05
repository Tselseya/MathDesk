import { useEffect, useState } from 'react';
import { ExternalLink, LineChart, X } from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';

const GEOGEBRA_URL = 'https://www.geogebra.org/graphing';
const LOAD_TIMEOUT_MS = 12_000;

interface GraphingToolProps { onClose: () => void; }

export default function GraphingTool({ onClose }: GraphingToolProps) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dialogRef = useDialogA11y<HTMLElement>(onClose);

  useEffect(() => {
    setLoaded(false);
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [attempt]);

  return (
    <div className="tool-modal-overlay">
      <section ref={dialogRef} tabIndex={-1} className="graph-card" role="dialog" aria-modal="true" aria-labelledby="graph-title">
        <header className="tool-modal-header">
          <div><span className="eyebrow"><LineChart size={14} /> Visualize relationships</span><h2 id="graph-title">Graphing Calculator</h2></div>
          <button className="tool-close" onClick={onClose} aria-label="Close graphing tool"><X size={18} /></button>
        </header>
        {!loaded && (
          <p className="graph-status" role="status">
            {slow ? 'GeoGebra is taking a while to load (it may be blocked or offline). ' : 'Loading the graphing calculator… '}
            {slow && <><button type="button" className="graph-link" onClick={() => setAttempt((count) => count + 1)}>Try again</button> or{' '}</>}
            <a className="graph-link" href={GEOGEBRA_URL} target="_blank" rel="noopener noreferrer">open it in a new tab <ExternalLink size={13} /></a>
          </p>
        )}
        <iframe key={attempt} title="GeoGebra graphing calculator" src={GEOGEBRA_URL} allowFullScreen onLoad={() => { setLoaded(true); setSlow(false); }} />
      </section>
    </div>
  );
}

