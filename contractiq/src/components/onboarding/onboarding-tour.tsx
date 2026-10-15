'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

export interface TourStep {
  anchor: string;
  title: string;
  body: string;
}

export const RESULTS_TOUR: TourStep[] = [
  {
    anchor: 'confidence',
    title: 'Confidence score',
    body: 'Green is high, amber medium, red low. Red terms show a warning: always check them.',
  },
  {
    anchor: 'page-link',
    title: 'Jump to the source',
    body: 'Click a page number to see exactly where this term appears.',
  },
  {
    anchor: 'chat-tab',
    title: 'Ask questions',
    body: 'Chat answers only from this document and cites pages.',
  },
];

// First-run tooltip tour anchored to [data-tour] elements; skips anchors that aren't visible.
export function OnboardingTour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [anchors, setAnchors] = useState<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setAnchors(
        steps.map((s) => {
          const el = document.querySelector<HTMLElement>(`[data-tour="${s.anchor}"]`);
          return el && el.offsetParent !== null ? el : null;
        }),
      );
    }, 300);
    return () => clearTimeout(t);
  }, [steps]);

  const available = useMemo(() => steps.map((s, i) => ({ ...s, el: anchors[i] ?? null })).filter((s) => s.el), [steps, anchors]);
  const step = available[index];

  useEffect(() => {
    if (anchors.length && available.length === 0) onDone();
  }, [anchors.length, available.length, onDone]);

  if (!step?.el) return null;
  const rect = step.el.getBoundingClientRect();
  const last = index === available.length - 1;

  return (
    <Popover open onOpenChange={(open) => !open && onDone()}>
      <PopoverAnchor
        style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height, pointerEvents: 'none' }}
      />
      <PopoverContent side="bottom" align="start" className="flex flex-col gap-2" onEscapeKeyDown={onDone}>
        <p className="text-body-sm text-secondary">
          {index + 1} of {available.length}
        </p>
        <p className="text-body-lg">{step.title}</p>
        <p className="text-body-sm text-secondary">{step.body}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Button variant="link" size="sm" onClick={onDone}>
            Skip tour
          </Button>
          <div className="flex gap-1">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setIndex((i) => i - 1)}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? onDone() : setIndex((i) => i + 1))}>
              {last ? 'Got it' : 'Next'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
