'use client';

import type { ContractType } from '@/types/api';

const SUGGESTIONS: Record<ContractType, string[]> = {
  NDA: [
    'What counts as confidential information?',
    'How long do the confidentiality obligations last?',
    'What happens if I breach this agreement?',
  ],
  MSA: ['Is there an auto-renewal clause?', 'What is the liability cap?', 'How can either party terminate?'],
};

export function SuggestedQuestions({ contractType, onPick }: { contractType: ContractType; onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-default bg-primary p-4">
      <p className="text-body-lg">Ask anything about this contract</p>
      <p className="text-body-sm text-secondary">
        Answers come only from the document and cite the pages they rely on.
      </p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS[contractType].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-md border border-default bg-surface px-3 py-1.5 text-left text-body-sm text-primary hover:bg-subtle"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
