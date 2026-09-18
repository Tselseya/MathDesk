import { LineChart, X } from 'lucide-react';

interface GraphingToolProps { onClose: () => void; }
export default function GraphingTool({ onClose }: GraphingToolProps) {
  return <div className="tool-modal-overlay"><section className="graph-card" role="dialog" aria-modal="true" aria-labelledby="graph-title"><header className="tool-modal-header"><div><span className="eyebrow"><LineChart size={14} /> Visualize relationships</span><h2 id="graph-title">Graphing Calculator</h2></div><button className="tool-close" onClick={onClose} aria-label="Close graphing tool"><X size={18} /></button></header><iframe title="GeoGebra graphing calculator" src="https://www.geogebra.org/graphing" allowFullScreen /></section></div>;
}
