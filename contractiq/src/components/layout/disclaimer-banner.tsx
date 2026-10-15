import { Scale } from 'lucide-react';

// Always visible, not dismissible — PRD §9/§11.
export function DisclaimerBanner() {
  return (
    <p role="note" className="flex items-start gap-2 rounded-md border border-default bg-subtle px-3 py-2 text-body-sm text-secondary">
      <Scale className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      This is an AI-assisted review tool, not legal advice. Always verify critical terms with a qualified lawyer.
    </p>
  );
}
