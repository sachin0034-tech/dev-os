import { MAX_SOURCE_SENTENCE_CHARS, MAX_TERM_VALUE_CHARS } from '@/lib/constants/limits';
import { findPageOf } from '@/lib/pdf/page-markers';
import type { RequestedTerm } from './prompts/extraction/types';
import type { ExtractedTerm } from './schemas';

export interface ValidatedTerm {
  term_name: string;
  term_key: string;
  value: string | null;
  page_number: number | null;
  confidence_score: number;
  source_sentence: string | null;
  is_custom: boolean;
  display_order: number;
  validation_flags: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Checks the model's answers against the document — docs/specs/ai-extraction-pipeline.md §6.
export function validateTerms(
  raw: ExtractedTerm[],
  ctx: { requested: RequestedTerm[]; contractText: string; pageCount: number },
): { terms: ValidatedTerm[]; droppedUnknown: number } {
  const byKey = new Map<string, ExtractedTerm>();
  for (const t of raw) {
    const existing = byKey.get(t.term_key);
    if (!existing || t.confidence_score > existing.confidence_score) byKey.set(t.term_key, t);
  }
  const requestedKeys = new Set(ctx.requested.map((r) => r.key));
  const droppedUnknown = [...byKey.keys()].filter((k) => !requestedKeys.has(k)).length;

  const terms = ctx.requested.map((r): ValidatedTerm => {
    const base = { term_name: r.name, term_key: r.key, is_custom: r.custom, display_order: r.order };
    const t = byKey.get(r.key);
    if (!t) {
      return {
        ...base,
        value: null,
        page_number: null,
        confidence_score: 0,
        source_sentence: null,
        validation_flags: ['missing_from_output'],
      };
    }

    const flags: string[] = [];
    const value = t.value?.trim() ? t.value.trim().slice(0, MAX_TERM_VALUE_CHARS) : null;
    let source = t.source_sentence?.trim()
      ? t.source_sentence.trim().slice(0, MAX_SOURCE_SENTENCE_CHARS)
      : null;
    let conf = clamp(Math.round(Number.isFinite(t.confidence_score) ? t.confidence_score : 0), 0, 100);
    let page = t.page_number;

    if (value === null) {
      conf = 0;
      page = null;
      source = null;
    } else {
      if (page !== null && (page < 1 || page > ctx.pageCount)) {
        page = null;
        conf = Math.min(conf, 40);
        flags.push('page_out_of_range');
      }
      if (source === null) {
        conf = Math.min(conf, 30);
        flags.push('no_source');
      } else {
        const found = findPageOf(ctx.contractText, source);
        if (found === null) {
          conf = Math.min(conf, 40);
          flags.push('source_not_found');
        } else if (found !== page) {
          page = found;
          flags.push('page_corrected');
        }
      }
    }
    return { ...base, value, page_number: page, confidence_score: conf, source_sentence: source, validation_flags: flags };
  });

  return { terms, droppedUnknown };
}
