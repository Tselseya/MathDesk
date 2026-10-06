import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

let pageViewRequest: Promise<number | null> | null = null;

function countHomepageVisitOncePerPageLoad(): Promise<number | null> {
  if (!supabase) return Promise.resolve(null);
  if (pageViewRequest) return pageViewRequest;

  const request = Promise.resolve(supabase.rpc('increment_homepage_visit_count'))
    .then(({ data, error }) => {
      if (error) return null;
      const count = typeof data === 'number' ? data : typeof data === 'string' ? Number(data) : NaN;
      return Number.isSafeInteger(count) && count >= 0 ? count : null;
    })
    .catch(() => null);

  pageViewRequest = request;
  return request;
}

export default function VisitorCounterBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void countHomepageVisitOncePerPageLoad().then((nextCount) => {
      if (active) setCount(nextCount);
    });
    return () => {
      active = false;
    };
  }, []);

  const formattedCount = count === null ? '—' : count.toLocaleString('en-US');
  const accessibleLabel = count === null
    ? 'All-time homepage visits are currently unavailable.'
    : `${formattedCount} all-time homepage visits`;

  return (
    <aside
      className="visitor-counter"
      role="status"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      data-available={count !== null}
    >
      <span className="visitor-counter-dot" aria-hidden="true" />
      <strong className="visitor-counter-count">{formattedCount}</strong>
      <span className="visitor-counter-label">VISITS</span>
    </aside>
  );
}
