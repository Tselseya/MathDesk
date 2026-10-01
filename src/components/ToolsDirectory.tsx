import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Filter, Search } from 'lucide-react';

const tools = [
  {
    "name": "Photomath",
    "category": "solver",
    "description": "Scan handwritten or printed problems with a camera.",
    "url": "https://photomath.com",
    "logo": "/tool-logos/photomath.png"
  },
  {
    "name": "Wolfram Alpha",
    "category": "solver",
    "description": "Computational math for equations, calculus, statistics, and more.",
    "url": "https://www.wolframalpha.com/",
    "logo": "/tool-logos/wolfram-alpha.ico"
  },
  {
    "name": "Desmos",
    "category": "graphing",
    "description": "Plot functions, inequalities, and interactive graphs.",
    "url": "https://www.desmos.com/calculator",
    "logo": "/tool-logos/desmos.png"
  },
  {
    "name": "GeoGebra",
    "category": "graphing",
    "description": "Geometry, algebra, and graphing in one visual workspace.",
    "url": "https://www.geogebra.org/graphing",
    "logo": "/tool-logos/geogebra.png"
  },
  {
    "name": "Symbolab",
    "category": "solver",
    "description": "Step-by-step algebra, calculus, and trigonometry.",
    "url": "https://symbolab.com",
    "logo": "/tool-logos/symbolab.svg"
  },
  {
    "name": "Khan Academy",
    "category": "practice",
    "description": "Lessons from arithmetic through college calculus.",
    "url": "https://www.khanacademy.org/math",
    "logo": "/tool-logos/khan-academy.ico"
  },
  {
    "name": "OpenStax",
    "category": "textbook",
    "description": "Free, peer-reviewed college mathematics textbooks.",
    "url": "https://openstax.org/subjects/math",
    "logo": "/tool-logos/openstax.png"
  },
  {
    "name": "LibreTexts Math",
    "category": "textbook",
    "description": "Open textbooks for college math courses.",
    "url": "https://math.libretexts.org",
    "logo": "/tool-logos/libretexts.png"
  },
  {
    "name": "Mathway",
    "category": "solver",
    "description": "Problem solving from basic math through calculus.",
    "url": "https://mathway.com",
    "logo": "/tool-logos/mathway.png"
  },
  {
    "name": "Paul's Online Notes",
    "category": "reference",
    "description": "Worked notes for algebra, calculus, and differential equations.",
    "url": "https://tutorial.math.lamar.edu/",
    "logo": "/tool-logos/pauls-online-notes.ico"
  },
  {
    "name": "Brilliant.org",
    "category": "practice",
    "description": "Interactive puzzle-based math learning.",
    "url": "https://brilliant.org",
    "logo": "/tool-logos/brilliant.png"
  },
  {
    "name": "3Blue1Brown",
    "category": "reference",
    "description": "Visual explanations for deep conceptual understanding.",
    "url": "https://www.3blue1brown.com",
    "logo": "/tool-logos/3blue1brown.svg"
  },
  {
    "name": "Integral Calculator",
    "category": "solver",
    "description": "Symbolic definite and indefinite integral calculations.",
    "url": "https://integral-calculator.com",
    "logo": "/tool-logos/integral-calculator.png"
  },
  {
    "name": "Matrix Calculator",
    "category": "solver",
    "description": "Matrix operations, eigenvalues, and row reduction.",
    "url": "https://matrixcalc.org",
    "logo": "/tool-logos/matrix-calculator.png"
  },
  {
    "name": "Mathplanet",
    "category": "reference",
    "description": "Textbook-style explanations from pre-algebra to precalculus.",
    "url": "https://mathplanet.com",
    "logo": "/tool-logos/mathplanet.png"
  }
] as const;
const categories = ['all', 'solver', 'graphing', 'textbook', 'reference', 'practice'] as const;

export default function ToolsDirectory() {
  const [category, setCategory] = useState<(typeof categories)[number]>('all');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => tools.filter((tool) =>
    (category === 'all' || tool.category === category) &&
    `${tool.name} ${tool.description}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [category, query]);
  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>('.directory-card.reveal-on-scroll');
    if (!('IntersectionObserver' in window)) {
      cards.forEach((card) => card.classList.add('revealed'));
      return;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    }), { threshold: .12 });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [shown]);
  return <section className="tools-directory" aria-labelledby="tools-title">
    <div className="directory-heading"><div><p className="eyebrow"><Filter size={14} /> Curated resources</p>
      <h2 id="tools-title">Math tools & resources</h2>
      <p>Explore 15 places to calculate, visualize, study, and practice.</p></div>
      <label className="tool-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools" aria-label="Search tools" /></label>
    </div>
    <div className="category-row" aria-label="Filter resources">{categories.map((item) =>
      <button type="button" className={category === item ? 'active' : ''} aria-pressed={category === item} key={item} onClick={() => setCategory(item)}>{item === 'all' ? 'All' : item}</button>
    )}</div>
    <div className="tool-grid">{shown.map(({ name, category: group, description, url, logo }) =>
      <a className="directory-card reveal-on-scroll" href={url} target="_blank" rel="noopener noreferrer" key={name} aria-label={`${name} (opens in a new tab)`}>
        <span className={`tool-emoji ${group}`} aria-hidden="true"><img src={logo} alt="" width="34" height="34" loading="lazy" /></span>
        <div className="directory-meta"><span>{group}</span></div><h3>{name}</h3><p>{description}</p>
        <strong className="visit-link">Visit resource <ExternalLink size={14} /></strong>
      </a>
    )}</div>
    {shown.length === 0 && <p className="empty-tools" role="status">No resources match that search. Try another term or choose All.</p>}
  </section>;
}
