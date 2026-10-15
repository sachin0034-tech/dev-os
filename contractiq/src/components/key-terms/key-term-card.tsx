'use client';

import { Info, MoreHorizontal, Pencil, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { TERM_GLOSSARY } from '@/lib/constants/term-glossary';
import type { KeyTerm } from '@/types/api';
import { ConfidenceBadge } from './confidence-badge';
import { EditableValue } from './editable-value';
import { LowConfidenceWarning } from './low-confidence-warning';
import { PageLink } from './page-link';
import { WhyAccordion } from './why-accordion';

export function KeyTermCard({
  term,
  onNavigate,
  onSave,
  onRevert,
  tourAnchor,
}: {
  term: KeyTerm;
  onNavigate: (page: number, text: string | null) => void;
  onSave: (value: string) => void;
  onRevert: () => void;
  tourAnchor?: boolean;
}) {
  const glossary = term.isCustom ? undefined : TERM_GLOSSARY[term.termKey];
  const navigate = () => term.pageNumber !== null && onNavigate(term.pageNumber, term.sourceSentence);
  const showWarning = term.confidenceScore < 50 && term.value !== null && !term.isEdited;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-default bg-primary p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-body-lg">{term.termName}</h3>
          {glossary && (
            <SimpleTooltip content={glossary}>
              <button type="button" aria-label={`What is ${term.termName}?`} className="text-secondary">
                <Info className="h-4 w-4" aria-hidden />
              </button>
            </SimpleTooltip>
          )}
          {term.isCustom && <Badge tone="accent">Custom</Badge>}
          {term.isEdited && (
            <SimpleTooltip content={`Original AI value: ${term.originalValue ?? 'Not found'}`}>
              <span tabIndex={0}>
                <Badge tone="info">
                  <Pencil className="h-3 w-3" aria-hidden />
                  Edited
                </Badge>
              </span>
            </SimpleTooltip>
          )}
        </div>
        {term.isEdited && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`More actions for ${term.termName}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-subtle"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onRevert}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Revert to AI value
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <EditableValue termName={term.termName} value={term.value} onSave={onSave} />

      <div className="flex flex-wrap items-center gap-3">
        <PageLink page={term.pageNumber} onNavigate={navigate} />
        <span data-tour={tourAnchor ? 'confidence' : undefined}>
          <ConfidenceBadge score={term.confidenceScore} />
        </span>
      </div>

      {showWarning && <LowConfidenceWarning />}

      <WhyAccordion
        sourceSentence={term.sourceSentence}
        page={term.pageNumber}
        flags={term.flags}
        onNavigate={navigate}
      />
    </li>
  );
}
