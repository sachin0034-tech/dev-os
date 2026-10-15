import { describe, expect, it } from 'vitest';
import type { RequestedTerm } from '@/lib/ai/prompts/extraction/types';
import { validateTerms } from '@/lib/ai/validate-terms';
import { findPageOf, splitPages } from '@/lib/pdf/page-markers';

const contractText = `[PAGE 1]
This Agreement is made between Acme Corp and Beta LLC.
[PAGE 2]
This Agreement shall be governed by the laws of the State of Delaware.
[PAGE 3]
Either party may terminate on thirty days' written notice.`;

const requested: RequestedTerm[] = [
  { key: 'parties', name: 'Parties', definition: null, custom: false, order: 1 },
  { key: 'governing_law', name: 'Governing Law', definition: null, custom: false, order: 2 },
  { key: 'custom_radius', name: 'Radius', definition: null, custom: true, order: 101 },
];

const term = (o: Partial<Parameters<typeof validateTerms>[0][number]>) => ({
  term_key: 'parties',
  term_name: 'Parties',
  value: 'Acme Corp and Beta LLC',
  page_number: 1,
  confidence_score: 95,
  source_sentence: 'This Agreement is made between Acme Corp and Beta LLC.',
  ...o,
});

const run = (raw: Parameters<typeof validateTerms>[0]) =>
  validateTerms(raw, { requested, contractText, pageCount: 3 });

describe('page markers', () => {
  it('splits pages and finds the page of a sentence', () => {
    expect(splitPages(contractText).map((p) => p.page)).toEqual([1, 2, 3]);
    expect(findPageOf(contractText, 'governed by the laws of the State of Delaware')).toBe(2);
    expect(findPageOf(contractText, 'Something not in the contract at all')).toBeNull();
  });
});

describe('validateTerms', () => {
  it('returns every requested term in order, marking omitted ones as not found', () => {
    const { terms } = run([term({})]);
    expect(terms.map((t) => t.term_key)).toEqual(['parties', 'governing_law', 'custom_radius']);
    expect(terms[1]).toMatchObject({ value: null, confidence_score: 0, validation_flags: ['missing_from_output'] });
    expect(terms[2]).toMatchObject({ is_custom: true, display_order: 101 });
  });

  it('keeps a valid term unchanged', () => {
    expect(run([term({})]).terms[0]).toMatchObject({ page_number: 1, confidence_score: 95, validation_flags: [] });
  });

  it('forces confidence 0 and clears page/source when value is null', () => {
    const t = run([term({ value: '  ', confidence_score: 80 })]).terms[0]!;
    expect(t).toMatchObject({ value: null, page_number: null, source_sentence: null, confidence_score: 0 });
  });

  it('corrects the page from the source sentence', () => {
    const t = run([term({ term_key: 'governing_law', page_number: 1, source_sentence: 'This Agreement shall be governed by the laws of the State of Delaware.' })]).terms[1]!;
    expect(t.page_number).toBe(2);
    expect(t.validation_flags).toContain('page_corrected');
  });

  it('caps confidence for an invented source sentence', () => {
    const t = run([term({ source_sentence: 'The parties agree to a 50-mile non-compete radius.' })]).terms[0]!;
    expect(t.confidence_score).toBe(40);
    expect(t.validation_flags).toContain('source_not_found');
  });

  it('caps confidence when there is no source sentence', () => {
    const t = run([term({ source_sentence: null })]).terms[0]!;
    expect(t.confidence_score).toBe(30);
    expect(t.validation_flags).toEqual(['no_source']);
  });

  it('handles out-of-range pages, duplicates, unknown keys and clamping', () => {
    const { terms, droppedUnknown } = run([
      term({ confidence_score: 60 }),
      term({ confidence_score: 140.6, page_number: 9 }),
      term({ term_key: 'made_up', confidence_score: 99 }),
    ]);
    // duplicate keeps the higher score (140.6 → clamped 100, then page fix)
    expect(terms[0]!.confidence_score).toBe(40);
    expect(terms[0]!.validation_flags).toEqual(['page_out_of_range', 'page_corrected']);
    expect(terms[0]!.page_number).toBe(1);
    expect(droppedUnknown).toBe(1);
  });
});
