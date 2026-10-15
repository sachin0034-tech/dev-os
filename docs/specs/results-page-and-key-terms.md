# Spec — F05 Results Page & Key-Terms Panel

**Source:** engineering-doc.md §4.7, §5.3, §9.3 #4 · **Stories:** US-002, US-003, US-004 · **FR:** FR-04, FR-11 · PRD §9 guardrails

---

## 1. Scope

`/contracts/[id]`: two-pane review screen. Right pane = key-terms panel (name, value, page, confidence band, low-confidence warning, "Why?" source, Custom/Edited badges, always-visible disclaimer, feedback). Left pane = viewer (contract-viewer.md). Chat is a tab in the right pane (contract-chat.md).

## 2. Files

| File | Responsibility |
|---|---|
| `src/app/(app)/contracts/[id]/page.tsx` | Server Component: load detail, touch `last_accessed_at`, redirect by status |
| `src/app/(app)/contracts/[id]/{loading,error,not-found}.tsx` | States |
| `src/app/api/contracts/[id]/route.ts` | GET detail (and DELETE — retention-and-deletion.md) |
| `src/lib/services/contracts.service.ts` | `getContractDetail(supabase, id, { includeText })` |
| `src/lib/services/mappers.ts` | `toContractDetail`, `toKeyTerm` |
| `src/stores/results-ui-store.ts` | Tab, filter, expanded "Why?" ids |
| `src/hooks/use-contract.ts` | Query + polling |
| `src/components/key-terms/*`, `src/components/layout/disclaimer-banner.tsx`, `src/components/contracts/results-layout.tsx` | UI |

## 3. Types — `src/types/api.ts`

```ts
export type ContractStatus = 'uploading' | 'ready' | 'processing' | 'completed' | 'error';
export interface ContractSummary {
  id: string; fileName: string; contractType: 'NDA' | 'MSA'; status: ContractStatus;
  pageCount: number | null; createdAt: string; processingCompletedAt: string | null; lowConfidenceCount: number;
}
export interface ContractDetail extends ContractSummary {
  hasPdf: boolean; pdfDeletedAt: string | null; errorCode: string | null; errorMessage: string | null; promptVersion: string | null;
  wordCount: number | null; tokenCount: number | null;
}
export interface KeyTerm {
  id: string; termKey: string; termName: string;
  value: string | null; originalValue: string | null;
  pageNumber: number | null; confidenceScore: number; confidenceBand: 'high' | 'medium' | 'low';
  sourceSentence: string | null; isCustom: boolean; isEdited: boolean; editedAt: string | null; flags: string[];
}
export interface CustomTerm { id: string; termName: string; termKey: string; }
export interface ContractDetailResponse {
  contract: ContractDetail; keyTerms: KeyTerm[]; customTerms: CustomTerm[];
  feedback: { rating: 1 | -1; comment: string | null } | null;
  contractText?: string;   // only with ?include=text
}
```

## 4. API — GET `/api/contracts/{id}`

`withHandler({ params: idParamSchema, query: z.object({ include: z.literal('text').optional() }) })`

1. `contracts` select (RLS) → null → `NOT_FOUND`.
2. If `status === 'processing'` and `processing_started_at < now - STALE_PROCESSING_MS` → return status `error`, `errorCode: 'STALE_PROCESSING'`, `errorMessage: 'Analysis was interrupted. Try again.'` (row is not modified here; the process route accepts stale claims).
3. Parallel: `key_terms` ordered by `display_order`; `custom_key_terms` ordered by `created_at`; `user_feedback` maybeSingle.
4. Fire-and-forget `supabase.from('contracts').update({ last_accessed_at: now }).eq('id', id)` (allowed column).
5. `contract_text` only when `include=text`.
6. **200** `ContractDetailResponse`. Errors 400/401/404.

## 5. Page behaviour (Server Component)

```
detail = getContractDetail(...)            → null → notFound()
status 'uploading'                          → redirect('/dashboard')
status 'ready'                              → redirect(`/contracts/new?resume=${id}`)
otherwise render <ResultsLayout initialData={detail} onboardingCompleted={profile.onboarding_completed_at != null} />
```
`useContract(id, initialData)`: `refetchInterval: (q) => q.state.data?.contract.status === 'processing' ? 2000 : false`.

Status rendering inside the right pane:
- `processing` → `ProcessingProgress` (step 2 active) and polling.
- `error` → `ProcessingError` with Try again (`useProcessContract`).
- `completed` → key-terms panel.

## 6. Layout — `ResultsLayout`

```
┌ Header: ← Dashboard | {fileName} [NDA] · 12 pages · Reviewed 11 Oct 2026 | [⋯ Delete] ┐
├───────────────────────────────┬───────────────────────────────────────────────┤
│ DocumentPane (55% ≥1280,      │ Tabs: [Key Terms] [Chat]                       │
│   50% 1024–1279)              │  DisclaimerBanner (always)                     │
│                               │  KeyTermsSummary (band chips)                  │
│                               │  TypeMismatchNotice (conditional)              │
│                               │  KeyTermList → KeyTermCard × n                 │
│                               │  FeedbackWidget                                │
└───────────────────────────────┴───────────────────────────────────────────────┘
< 1024px: single column with tab bar [Document · Key Terms · Chat]
```
Both panes scroll independently (`overflow-y-auto`), height `calc(100dvh - 64px)` (header 64px).

`useResultsUiStore`: `{ activeTab: 'terms' | 'chat' | 'document', bandFilter: 'all' | 'high' | 'medium' | 'low', expandedWhy: string[] }` (`document` only used < 1024px).

## 7. Components

| Component | Props | Behaviour |
|---|---|---|
| `DisclaimerBanner` | — | `role="note"`, neutral info alert: "This is an AI-assisted review tool, not legal advice. Always verify critical terms with a qualified lawyer." No close button |
| `KeyTermsSummary` | `terms`, `filter`, `onFilter` | Chips: "All {n}", "High {h}", "Medium {m}", "Low {l}"; `aria-pressed`; selected chip outlined `border-brand` |
| `TypeMismatchNotice` | `terms`, `contractType` | Shown when ≥ 60% of standard terms have `value === null`: warning alert "Most terms weren't found. Is this really an {NDA/MSA}? Results may be incomplete." |
| `KeyTermList` | `terms`, `filter` | `<ul>`; filtered by band; empty filter → "No terms in this band." |
| `KeyTermCard` | `term`, `onNavigate` | Card. Row 1: term name (body-lg) + glossary tooltip icon (standard terms) + badges (Custom, Edited). Row 2: `EditableValue` (key-term-editing.md); null value → "Not found in document" (secondary). Row 3 (body-sm): `PageLink` · `ConfidenceBadge` · `WhyToggle`. Row 4 (conditional): `LowConfidenceWarning`. `WhyAccordion` below. `data-tour` anchors on first card |
| `ConfidenceBadge` | `score` | Badge per design-tokens.md §6; `aria-label="Confidence {score} percent, {band}"` |
| `LowConfidenceWarning` | — | Rendered when `score < 50` and value not null: danger-tint inline box with `TriangleAlert` + "Low confidence — we recommend verifying this in the document directly." Always visible (non-dismissible) |
| `PageLink` | `page`, `sourceSentence`, `onNavigate` | Text button "p. {page}" (brand, underline on hover); `null` → "Page not identified" (secondary, not a button) |
| `WhyAccordion` | `id`, `sourceSentence`, `page` | Toggle "Why?" (`aria-expanded`); panel: blockquote with `border-l-2 border-strong pl-3 text-body-lg`, caption "Page {page}" with link; null source → "No supporting sentence found — treat this value as unverified." Flags `source_not_found` add caption "We couldn't locate this exact sentence in the document." |

`onNavigate(page, text)` → `useViewerStore.getState().setTarget(page, text)`; on < 1024px also `setActiveTab('document')`.

Auto-navigation: on first render of a completed contract, if the viewer store has `userHasNavigated === false` and there's a low-confidence term with a page, call `setTarget(firstLow.page, firstLow.sourceSentence, { auto: true })` (does not set `userHasNavigated`).

## 8. Design

Right pane `bg-surface p-4 gap-2`; cards `bg-primary rounded-lg border p-4 flex flex-col gap-2`. Header `h-16 bg-primary border-b px-6 flex items-center gap-4`; title body-lg medium truncate; type badge neutral. No shadows. Term values `text-body-lg text-primary whitespace-pre-wrap`, clamped at 6 lines with "Show more".

## 9. Edge cases

- Foreign/unknown id → `notFound()`; malformed id → `notFound()`.
- All terms null → TypeMismatchNotice + all red badges remain visible (terms never hidden).
- 17 terms (12 + 5 custom) → list scrolls; summary counts include custom.
- Contract deleted in another tab → next poll 404 → toast "This contract was deleted" + redirect to dashboard.
- `processing` stale → error card with Try again.

## Acceptance criteria

The feature is done when all of these are true:

- [ ] Each term shows name, value, page number and confidence % with a colour + text band: ≥ 80 High (green), 50–79 Medium (amber), < 50 Low (red) (FR-04).
- [ ] Every term with confidence < 50 shows the ⚠️ warning "Low confidence — we recommend verifying this in the document directly."; terms are never hidden (FR-11).
- [ ] "Why?" reveals the verbatim source sentence and its page.
- [ ] The "not legal advice" disclaimer is always visible on the results page and cannot be dismissed.
- [ ] While processing, the page polls and switches to results automatically; a failed or interrupted run shows Try again.
- [ ] If most standard terms are not found, the "Is this really an NDA/MSA?" notice appears.
- [ ] Another user's contract id shows the not-found page.
- [ ] Layout is two-pane at ≥ 1024px and tabbed (Document · Key Terms · Chat) below.

## 10. Tests

- Unit: `confidenceBand`, `ConfidenceBadge` labels/tones at 0/49/50/79/80/100, `LowConfidenceWarning` rendered only < 50 with value, `TypeMismatchNotice` threshold.
- Integration: GET detail hides `contractText` unless `include=text`; stale processing reported as error; other user → 404.
- E2E (`results.spec.ts`): after processing, disclaimer visible, low-confidence warning text visible for a < 50 term, "Why?" reveals source sentence, clicking "p. N" scrolls viewer to page N.
