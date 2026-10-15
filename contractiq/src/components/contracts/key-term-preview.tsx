'use client';

import { MAX_CUSTOM_TERMS } from '@/lib/constants/limits';
import { STANDARD_TERMS } from '@/lib/constants/standard-terms';
import type { CustomTermDraft } from '@/stores/upload-store';
import type { ContractType } from '@/types/api';
import { AddCustomTermInput } from './add-custom-term-input';
import { TermPreviewItem } from './term-preview-item';

export function KeyTermPreview({
  contractType,
  drafts,
  locked,
  onAdd,
  onRemove,
  onRetry,
}: {
  contractType: ContractType;
  drafts: CustomTermDraft[];
  locked: boolean;
  onAdd: (name: string) => void;
  onRemove: (tempId: string) => void;
  onRetry: (tempId: string) => void;
}) {
  const standard = STANDARD_TERMS[contractType];
  const visibleDrafts = drafts.filter((d) => !d.pendingRemoval);
  return (
    <section aria-labelledby="preview-title" className="flex flex-col gap-4 rounded-lg border border-default bg-primary p-6">
      <header className="flex flex-col gap-0.5">
        <h2 id="preview-title" className="text-h5">
          Terms we&apos;ll look for
        </h2>
        <p className="text-body-sm text-secondary">
          {standard.length} standard terms · {visibleDrafts.length}/{MAX_CUSTOM_TERMS} custom
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {standard.map((t) => (
          <TermPreviewItem key={t.key} name={t.name} plainEnglish={t.plainEnglish} />
        ))}
        {visibleDrafts.map((d) => (
          <TermPreviewItem
            key={d.tempId}
            name={d.termName}
            isCustom
            status={d.status}
            error={d.error}
            locked={locked}
            onRemove={() => onRemove(d.tempId)}
            onRetry={() => onRetry(d.tempId)}
          />
        ))}
      </ul>
      {!locked && (
        <AddCustomTermInput
          existing={[...standard.map((t) => t.name), ...visibleDrafts.map((d) => d.termName)]}
          count={visibleDrafts.length}
          onSubmit={onAdd}
        />
      )}
    </section>
  );
}
