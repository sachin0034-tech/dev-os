'use client';

import { Info, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SimpleTooltip } from '@/components/ui/tooltip';

export function TermPreviewItem({
  name,
  plainEnglish,
  isCustom,
  status,
  error,
  locked,
  onRemove,
  onRetry,
}: {
  name: string;
  plainEnglish?: string;
  isCustom?: boolean;
  status?: 'queued' | 'saving' | 'saved' | 'error';
  error?: string;
  locked?: boolean;
  onRemove?: () => void;
  onRetry?: () => void;
}) {
  return (
    <li className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-default bg-primary px-3 py-1.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-body-lg">{name}</span>
        {plainEnglish && (
          <SimpleTooltip content={plainEnglish}>
            <button type="button" aria-label={`What is ${name}?`} className="text-secondary">
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </SimpleTooltip>
        )}
        {isCustom && <Badge tone="accent">Custom</Badge>}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-brand" aria-label="Saving" />}
        {status === 'error' && (
          <span className="text-body-sm text-danger-text">
            {error ?? "Couldn't save"} ·{' '}
            <button type="button" onClick={onRetry} className="underline">
              Retry
            </button>
          </span>
        )}
        {isCustom && !locked && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${name}`}
            className="flex h-6 w-6 items-center justify-center rounded-md text-secondary hover:bg-subtle"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </span>
    </li>
  );
}
