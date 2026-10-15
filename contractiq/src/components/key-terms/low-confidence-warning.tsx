import { TriangleAlert } from 'lucide-react';

export const LOW_CONFIDENCE_MESSAGE = 'Low confidence — we recommend verifying this in the document directly.';

// Always visible (non-dismissible) for terms scored below 50 — PRD FR-11.
export function LowConfidenceWarning() {
  return (
    <p role="note" className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-tint px-3 py-2 text-body-sm text-danger-text">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {LOW_CONFIDENCE_MESSAGE}
    </p>
  );
}
