import { useMemo, useState } from 'react';
import { BookOpen, ExternalLink, Filter, GraduationCap, LineChart, NotebookPen, Search, Shapes, Sigma } from 'lucide-react';

const tools = [
  { name: 'Desmos', category: 'graphing', description: 'Graph functions and explore equations interactively.', url: 'https://www.desmos.com/calculator', Icon: LineChart },
  { name: 'GeoGebra', category: 'graphing', description: 'Explore geometry, algebra, and interactive graphs.', url: 'https://www.geogebra.org/graphing', Icon: Shapes },
  { name: 'Wolfram|Alpha', category: 'solver', description: 'Investigate computations and step-by-step math.', url: 'https://www.wolframalpha.com/', Icon: Sigma },
  { name: 'Khan Academy', category: 'practice', description: 'Practice with guided math lessons and exercises.', url: 'https://www.khanacademy.org/math', Icon: GraduationCap },
  { name: 'OpenStax', category: 'textbook', description: 'Read free, peer-reviewed mathematics textbooks.', url: 'https://openstax.org/subjects/math', Icon: BookOpen },
  { name: "Paul's Online Math Notes", category: 'reference', description: 'Review worked algebra and calculus notes.', url: 'https://tutorial.math.lamar.edu/', Icon: NotebookPen },
] as const;
const categories = ['all', 'solver', 'graphing', 'textbook', 'reference', 'practice'] as const;

export default function ToolsDirectory() {
  const [category, setCategory] = useState<(typeof categories)[number]>('all');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => tools.filter((tool) =>
    (category === 'all' || tool.category === category) &&
    `${tool.name} ${tool.description}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [category, query]);
  return <section className="tools-directory" aria-labelledby="tools-title">
    <div className="directory-heading"><div><p className="eyebrow"><Filter size={14} /> Curated resources</p>
      <h2 id="tools-title">Math tools & resources</h2>
      <p>Six useful places to calculate, visualize, study, and practice.</p></div>
      <label className="tool-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools" aria-label="Search tools" /></label>
    </div>
    <div className="category-row" aria-label="Filter resources">{categories.map((item) =>
      <button type="button" className={category === item ? 'active' : ''} aria-pressed={category === item} key={item} onClick={() => setCategory(item)}>{item === 'all' ? 'All' : item}</button>
    )}</div>
    <div className="tool-grid">{shown.map(({ name, category: group, description, url, Icon }) =>
      <a className="directory-card" href={url} target="_blank" rel="noopener noreferrer" key={name} aria-label={`${name} (opens in a new tab)`}>
        <span className={`tool-emoji ${group}`} aria-hidden="true"><Icon size={23} strokeWidth={2} /></span>
        <div className="directory-meta"><span>{group}</span></div><h3>{name}</h3><p>{description}</p>
        <strong className="visit-link">Visit resource <ExternalLink size={14} /></strong>
      </a>
    )}</div>
    {shown.length === 0 && <p className="empty-tools" role="status">No resources match that search. Try another term or choose All.</p>}
  </section>;
}
