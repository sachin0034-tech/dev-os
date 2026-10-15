'use client';

import { Alert } from '@/components/ui/alert';
import { DisclaimerBanner } from '@/components/layout/disclaimer-banner';
import { FeedbackWidget } from '@/components/feedback/feedback-widget';
import { useUpdateKeyTerm } from '@/hooks/use-update-key-term';
import { useResultsUiStore } from '@/stores/results-ui-store';
import type { ContractDetailResponse } from '@/types/api';
import { KeyTermCard } from './key-term-card';
import { KeyTermsSummary } from './key-terms-summary';

const TYPE_MISMATCH_THRESHOLD = 0.6;

export function KeyTermsPanel({
  data,
  onNavigate,
}: {
  data: ContractDetailResponse;
  onNavigate: (page: number, text: string | null) => void;
}) {
  const { bandFilter, setBandFilter } = useResultsUiStore();
  const update = useUpdateKeyTerm(data.contract.id);
  const terms = data.keyTerms;
  const standard = terms.filter((t) => !t.isCustom);
  const notFoundShare = standard.length ? standard.filter((t) => t.value === null).length / standard.length : 0;
  const visible = bandFilter === 'all' ? terms : terms.filter((t) => t.confidenceBand === bandFilter);

  return (
    <div className="flex flex-col gap-4">
      <DisclaimerBanner />
      <KeyTermsSummary terms={terms} filter={bandFilter} onFilter={setBandFilter} />
      {notFoundShare >= TYPE_MISMATCH_THRESHOLD && (
        <Alert tone="warning" title={`Most terms weren't found. Is this really an ${data.contract.contractType}?`}>
          Results may be incomplete if the contract type doesn&apos;t match.
        </Alert>
      )}
      {visible.length === 0 ? (
        <p className="rounded-lg border border-default bg-primary p-4 text-body-sm text-secondary">
          No terms in this band.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((term, i) => (
            <KeyTermCard
              key={term.id}
              term={term}
              tourAnchor={i === 0}
              onNavigate={onNavigate}
              onSave={(value) => update.mutate({ id: term.id, body: { value } })}
              onRevert={() => update.mutate({ id: term.id, body: { revert: true } })}
            />
          ))}
        </ul>
      )}
      <FeedbackWidget contractId={data.contract.id} initial={data.feedback} />
    </div>
  );
}
