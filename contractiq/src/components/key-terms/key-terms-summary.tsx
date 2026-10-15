'use client';

import { cn } from '@/lib/utils/cn';
import type { BandFilter } from '@/stores/results-ui-store';
import type { KeyTerm } from '@/types/api';

export function KeyTermsSummary({
  terms,
  filter,
  onFilter,
}: {
  terms: KeyTerm[];
  filter: BandFilter;
  onFilter: (f: BandFilter) => void;
}) {
  const count = (b: BandFilter) => (b === 'all' ? terms.length : terms.filter((t) => t.confidenceBand === b).length);
  const chips: { id: BandFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by confidence">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={filter === c.id}
          onClick={() => onFilter(c.id)}
          className={cn(
            'h-8 rounded-md border px-3 text-body-sm transition-colors duration-micro',
            filter === c.id ? 'border-brand bg-brand-tint text-info-text' : 'border-default bg-primary text-secondary hover:bg-subtle',
          )}
        >
          {c.label} {count(c.id)}
        </button>
      ))}
    </div>
  );
}
