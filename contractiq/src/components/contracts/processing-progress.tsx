'use client';

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

const STEPS = ['Extracting text', 'Analysing with AI', 'Compiling results'] as const;

export function ProcessingProgress({ activeStep, startedAt }: { activeStep: 1 | 2 | 3; startedAt?: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = startedAt ?? Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-default bg-primary p-6" aria-live="polite">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-h5">Analysing your contract</h2>
        <span className="text-body-sm text-secondary">{elapsed}s</span>
      </header>
      <ol className="flex flex-col gap-2">
        {STEPS.map((label, i) => {
          const step = i + 1;
          const state = step < activeStep ? 'done' : step === activeStep ? 'active' : 'pending';
          return (
            <li key={label} className="flex items-center gap-2 text-body-lg">
              {state === 'done' && <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />}
              {state === 'active' && <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden />}
              {state === 'pending' && <Circle className="h-5 w-5 text-[var(--grey-300)]" aria-hidden />}
              <span className={cn(state === 'pending' && 'text-secondary')}>
                {label}
                <span className="sr-only">
                  {state === 'done' ? ' — done' : state === 'active' ? ' — in progress' : ' — pending'}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {elapsed >= 30 && activeStep === 2 && (
        <p className="text-body-sm text-secondary">Taking longer than usual — hang tight.</p>
      )}
    </section>
  );
}
