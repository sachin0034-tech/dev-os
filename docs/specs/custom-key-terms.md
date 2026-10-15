# Spec — F03 Key-Term Preview & Custom Terms

**Source:** engineering-doc.md §4.5, §8.2, §9.3 #6–7 · **Stories:** US-005 · **FR:** FR-05

---

## 1. Scope

As soon as a contract type is selected, show the standard terms ContractIQ will extract. Let the user add up to 5 custom terms (shown with a "Custom" badge) before processing.

## 2. Files

| File | Responsibility |
|---|---|
| `src/lib/constants/standard-terms.ts` | Standard term definitions (shared by UI, prompt, evals) |
| `src/app/api/contracts/[id]/custom-terms/route.ts` | POST |
| `src/app/api/contracts/[id]/custom-terms/[termId]/route.ts` | DELETE |
| `src/lib/services/custom-terms.service.ts` | `addCustomTerm`, `removeCustomTerm`, `listCustomTerms` |
| `src/lib/utils/slug.ts` | `toTermKey(name, custom)` |
| `src/components/contracts/{key-term-preview,term-preview-item,add-custom-term-input}.tsx` | UI |
| `src/hooks/use-custom-terms.ts` | Mutations |

## 3. Standard terms — `src/lib/constants/standard-terms.ts`

```ts
export interface TermDefinition { key: string; name: string; definition: string; plainEnglish: string; }

export const STANDARD_TERMS: Record<'NDA' | 'MSA', TermDefinition[]> = {
  NDA: [
    { key: 'parties', name: 'Parties', definition: 'Legal names of all parties to the agreement and their roles (disclosing/receiving).', plainEnglish: 'Who is signing this agreement.' },
    { key: 'effective_date', name: 'Effective Date', definition: 'The date the agreement takes effect.', plainEnglish: 'When the agreement starts applying.' },
    { key: 'confidentiality_obligations', name: 'Confidentiality Obligations', definition: 'What the receiving party must do and must not do with confidential information, and the standard of care required.', plainEnglish: 'What you must keep secret and how carefully.' },
    { key: 'permitted_disclosures', name: 'Permitted Disclosures', definition: 'Exceptions allowing disclosure (e.g. to employees/advisors with need-to-know, legally compelled disclosure) and exclusions from confidential information.', plainEnglish: 'When you are allowed to share the information.' },
    { key: 'term_and_duration', name: 'Term & Duration', definition: 'How long the agreement lasts and how long confidentiality obligations survive after it ends.', plainEnglish: 'How long the secrecy lasts.' },
    { key: 'governing_law', name: 'Governing Law', definition: 'The jurisdiction whose laws govern the agreement.', plainEnglish: "Which place's laws apply." },
    { key: 'jurisdiction', name: 'Jurisdiction', definition: 'The courts or venue where disputes must be brought.', plainEnglish: 'Where a dispute would be heard.' },
    { key: 'ip_ownership', name: 'IP Ownership', definition: 'Statements on ownership of intellectual property in disclosed information; any licence or assignment.', plainEnglish: 'Who owns ideas and materials shared.' },
    { key: 'non_solicitation', name: 'Non-Solicitation', definition: 'Restrictions on hiring or soliciting the other party\'s employees or customers, including duration.', plainEnglish: "Whether you can hire their people or approach their customers." },
    { key: 'breach_and_remedy', name: 'Breach & Remedy', definition: 'Consequences of breach: injunctive relief, damages, indemnity, return/destruction of information.', plainEnglish: 'What happens if someone breaks the agreement.' },
  ],
  MSA: [
    { key: 'parties', name: 'Parties', definition: 'Legal names of the customer and the service provider.', plainEnglish: 'Who is signing this agreement.' },
    { key: 'service_scope', name: 'Service Scope', definition: 'The services to be provided and how scope is defined (e.g. via Statements of Work).', plainEnglish: 'What work is being provided.' },
    { key: 'payment_terms', name: 'Payment Terms', definition: 'Fees, pricing basis and payment due period (e.g. net 30).', plainEnglish: 'How much and how fast you pay or get paid.' },
    { key: 'invoice_schedule', name: 'Invoice Schedule', definition: 'When and how invoices are issued (monthly, milestone, in advance/arrears).', plainEnglish: 'When invoices are sent.' },
    { key: 'late_payment_penalty', name: 'Late Payment Penalty', definition: 'Interest, fees or suspension rights for late payment.', plainEnglish: 'What happens if payment is late.' },
    { key: 'liability_cap', name: 'Liability Cap', definition: 'Maximum aggregate liability of each party and exclusions (e.g. indirect/consequential damages).', plainEnglish: 'The most either side can be made to pay if things go wrong.' },
    { key: 'indemnification', name: 'Indemnification', definition: 'Which party must defend/compensate the other for which third-party claims.', plainEnglish: 'Who covers the costs if someone else sues.' },
    { key: 'ip_ownership', name: 'IP Ownership', definition: 'Ownership of deliverables, pre-existing IP and licences granted.', plainEnglish: 'Who owns the work produced.' },
    { key: 'termination_clause', name: 'Termination Clause', definition: 'How and when either party may terminate (for convenience, for cause, cure periods) and effects of termination.', plainEnglish: 'How the agreement can be ended.' },
    { key: 'governing_law', name: 'Governing Law', definition: 'The jurisdiction whose laws govern the agreement.', plainEnglish: "Which place's laws apply." },
    { key: 'dispute_resolution', name: 'Dispute Resolution', definition: 'Process for disputes: negotiation, mediation, arbitration or courts, and venue.', plainEnglish: 'How disagreements get settled.' },
    { key: 'notice_period', name: 'Notice Period', definition: 'Required notice periods (termination, non-renewal) and how notices must be delivered.', plainEnglish: 'How much warning must be given, and how.' },
  ],
};
```
`plainEnglish` doubles as the jargon tooltip (`term-glossary.ts` re-exports a `Record<key, plainEnglish>`).

## 4. Slug — `toTermKey`

```ts
export const toTermKey = (name: string, custom: boolean) => {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'term';
  return custom ? `custom_${base}` : base;
};
```

## 5. Validation

```ts
export const customTermSchema = z.object({
  termName: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, ' '))
    .pipe(
      z.string()
        .min(CUSTOM_TERM_MIN, 'At least 2 characters')
        .max(CUSTOM_TERM_MAX, 'At most 80 characters')
        .regex(/^[\p{L}\p{N} &\-'/()]+$/u, "Use letters, numbers, spaces and & - ' / ( ) only"),
    ),
});
```

## 6. API

### POST `/api/contracts/{id}/custom-terms`
`withHandler({ params: idParamSchema, body: customTermSchema })`
1. Load contract via user client → `NOT_FOUND`; status ∉ {`uploading`, `ready`} → `INVALID_STATE`.
2. If `STANDARD_TERMS[type].some(t => t.name.toLowerCase() === termName.toLowerCase())` → `CUSTOM_TERM_DUPLICATE`.
3. `supabase.from('custom_key_terms').insert({ contract_id: id, user_id, term_name }).select().single()` → map PG errors (`23505` → duplicate, `P0001 CUSTOM_TERM_LIMIT` → 422).
4. **201** `{ id, termName, termKey: toTermKey(termName, true) }`.

### DELETE `/api/contracts/{id}/custom-terms/{termId}`
1. Load contract (status check as above).
2. `supabase.from('custom_key_terms').delete().eq('id', termId).eq('contract_id', id).select('id')` → 0 rows → `NOT_FOUND`.
3. **204**.

## 7. State

Custom terms can be added before `contractId` exists (while uploading):
```ts
type CustomTermDraft = { tempId: string; id?: string; termName: string; status: 'queued' | 'saving' | 'saved' | 'error' };
```
- Add: validate client-side (schema + duplicates against standard + existing drafts, case-insensitive; max 5) → push `queued` → if `contractId` → `saving` → POST → `saved` with `id`.
- After `/init` returns, flush all `queued` drafts sequentially.
- Remove: `saved` → optimistic remove + DELETE (restore + toast on failure); `queued`/`error` → remove locally; `saving` → mark `pendingRemoval`, DELETE after save resolves.
- `ProcessButton` disabled while any draft is `queued` or `saving`; `error` drafts show "Retry" and block processing until retried or removed.

## 8. Components

| Component | Props | Behaviour |
|---|---|---|
| `KeyTermPreview` | `contractType`, `drafts`, `onAdd`, `onRemove`, `locked` | Card, title "Terms we'll look for" (H5), subtitle "{n} standard terms · {m}/5 custom" (body-sm secondary). Grid `grid-cols-1 sm:grid-cols-2 gap-2`. Hidden until type chosen |
| `TermPreviewItem` | `name`, `plainEnglish?`, `isCustom`, `status?`, `onRemove?` | Body-lg name; standard → info icon with tooltip `plainEnglish`; custom → accent badge "Custom" + remove button `aria-label="Remove {name}"`; `saving` spinner; `error` danger text "Couldn't save · Retry" |
| `AddCustomTermInput` | `existing: string[]`, `onSubmit`, `disabled`, `count` | Ghost button "+ Add Key Term" → inline input with placeholder "e.g. Non-compete radius", Add button; Enter adds, Esc cancels; inline error; counter "{count}/5"; disabled at 5 with helper "You can add up to 5 custom terms" |

## 9. Edge cases

- Duplicate of standard term ("governing law") → client error "That term is already in the list"; server enforces too.
- Concurrent adds from two tabs → DB trigger locks parent row; 6th fails with 422.
- Adding after processing started → 409; UI is `locked` from `processing` onward.
- Emoji/symbols → rejected by regex.
- Upload fails after terms queued → drafts kept; if a new contract is initialised they are flushed to it.

## Acceptance criteria

The feature is done when all of these are true:

- [ ] Selecting NDA shows exactly the 10 NDA standard terms; MSA shows the 12 MSA terms, before upload finishes.
- [ ] The user can add up to 5 custom terms, each shown with a "Custom" badge; the 6th is blocked in the UI and rejected by the API (422).
- [ ] Duplicates (case-insensitive, including standard term names) are rejected with "That term is already in the list".
- [ ] Custom terms added during upload are saved once the contract exists; Process stays disabled until all are saved.
- [ ] Removing a custom term removes it from the preview and the database.
- [ ] After processing, every custom term appears in results with value, page and confidence like standard terms (US-005, FR-05).

## 10. Tests

- Unit: `toTermKey`, `customTermSchema` (valid, too short, symbols, whitespace collapse).
- Integration: add 5 → 6th 422; duplicate (case-insensitive) 409; standard-name duplicate 409; add on `completed` contract 409; delete other user's term 404.
- E2E: add "Non-compete radius" → Custom badge visible → appears in results with Custom badge.
