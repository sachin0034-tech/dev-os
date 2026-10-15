'use client';

import { useMemo, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { splitPages } from '@/lib/pdf/page-markers';
import { findRange } from '@/lib/viewer/highlight';
import { usePageNavigation } from './use-page-navigation';

function PageBody({ text, highlight }: { text: string; highlight: string | null }) {
  const range = highlight ? findRange(text, highlight) : null;
  if (!range) return <>{text}</>;
  const [start, end] = range;
  return (
    <>
      {text.slice(0, start)}
      <mark className="ci-highlight">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

// Fallback viewer: renders the stored contract text page by page (contract-viewer.md §7).
export function ContractTextViewer({ text, loading }: { text: string | undefined; loading?: boolean }) {
  const pages = useMemo(() => (text ? splitPages(text) : []), [text]);
  const slotRefs = useRef<(HTMLElement | null)[]>([]);
  const highlight = usePageNavigation(slotRefs, pages.length > 0);

  if (loading || text === undefined) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {pages.map((p, i) => (
        <section
          key={p.page}
          id={`page-${p.page}`}
          data-page={p.page}
          ref={(el) => {
            slotRefs.current[i] = el;
          }}
          aria-label={`Page ${p.page}`}
          className="rounded-lg border border-default bg-primary"
        >
          <header className="sticky top-0 border-b border-default bg-primary px-6 py-2 text-body-sm text-secondary">
            Page {p.page}
          </header>
          <p className="whitespace-pre-wrap px-6 py-4 text-body-lg">
            <PageBody text={p.text} highlight={highlight?.page === p.page ? highlight.text : null} />
          </p>
        </section>
      ))}
    </div>
  );
}
