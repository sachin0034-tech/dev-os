# Spec — F09 Dashboard & Contract History

**Source:** engineering-doc.md §4.3, §9.3 #3 · **Stories:** US-008 · **FR:** FR-10 · PRD Flow 1–2

---

## 1. Scope

`/dashboard`: greeting + "Review a Contract" CTA, summary cards (total reviewed, NDA count, MSA count), trial usage meter, and a sortable, paginated table of the user's contracts. Rows open the results page. Empty state for new users.

## 2. Files

| File | Responsibility |
|---|---|
| `src/app/(app)/dashboard/{page,loading,error}.tsx` | Page (Server Component, reads `searchParams`) |
| `src/app/api/contracts/route.ts` | GET list |
| `src/lib/services/contracts.service.ts` | `listContracts`, `getDashboardSummary` |
| `src/lib/validation/contracts.ts` | `listContractsQuerySchema` |
| `src/hooks/use-contracts.ts` | Query |
| `src/components/dashboard/{dashboard-header,summary-cards,stat-card,usage-meter,contracts-table,sortable-header,contract-row,status-badge,row-actions-menu,empty-state,pagination}.tsx` | UI |

## 3. Query schema

```ts
export const listContractsQuerySchema = z.object({
  sort: z.enum(['created_at', 'file_name', 'contract_type', 'status']).default('created_at'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
```

## 4. API — GET `/api/contracts`

Service `listContracts(supabase, q)`:
```ts
const from = (q.page - 1) * q.pageSize;
const { data, count } = await supabase
  .from('contract_list_items')          // view: excludes 'uploading', includes low_confidence_count (RLS via security_invoker)
  .select('*', { count: 'exact' })
  .order(q.sort, { ascending: q.dir === 'asc' })
  .order('id', { ascending: true })     // stable paging
  .range(from, from + q.pageSize - 1);
```
Stale `processing` rows (started > 3 min ago) are mapped to `status: 'error'` in `toContractSummary`.

`getDashboardSummary(supabase)`: one query on `contract_list_items` selecting `contract_type, status` → `{ total: count(status = 'completed'), nda: count(type NDA & completed), msa: count(type MSA & completed) }` ("reviewed" = completed).

**200** `{ items: ContractSummary[], total, page, pageSize, summary: { total, nda, msa } }`. Errors 400, 401.

## 5. Page

Server Component: parse `searchParams` with the same schema (invalid → defaults), call services directly, render with `initialData`. Client table uses `useContracts(q)` (`placeholderData: keepPreviousData`) and updates URL via `router.replace('?sort=…&dir=…&page=…', { scroll: false })`.

## 6. Components

| Component | Props | Behaviour |
|---|---|---|
| `DashboardHeader` | `email` | H5 "Your contracts"; body-sm secondary "Review NDAs and MSAs in minutes."; primary `ReviewContractButton` → `/contracts/new` (disabled with tooltip when usage `canAnalyse === false`) |
| `SummaryCards` | `summary` | 3 `StatCard`s in `grid grid-cols-1 sm:grid-cols-3 gap-4` |
| `StatCard` | `label`, `value` | Card; value `text-h5`; label body-sm secondary |
| `UsageMeter` | — (uses `useUsage`) | Card: "{used} of {limit} trial analyses used · {daysLeft} days left" + bar (`bg-subtle` track, fill `bg-brand`; ≥ 80% `bg-warning`; 100% `bg-danger`); paid plan unlimited → "Unlimited analyses"; hidden while loading |
| `ContractsTable` | `items`, `sort`, `dir`, `page`, `total`, `pageSize`, `onSort`, `onPage` | `<table>` with caption (sr-only) "Your contracts"; columns Name · Type · Uploaded · Status · Low confidence · actions |
| `SortableHeader` | `column`, `label`, `active`, `dir`, `onSort` | Button inside `<th aria-sort>`; first click on a new column → `asc` (date → `desc`) |
| `ContractRow` | `item` | Whole row clickable (`onClick` + `onKeyDown` Enter, `tabIndex=0`, `role="link"`); `completed`/`error`/`processing` → `/contracts/{id}`; `ready` → `/contracts/new?resume={id}`. Name truncated with `title` tooltip. Uploaded = `format(createdAt, 'd MMM yyyy')` via `Intl.DateTimeFormat`. Low confidence: `n` with danger badge if > 0 else "—" |
| `StatusBadge` | `status` | design-tokens.md §6 |
| `RowActionsMenu` | `item` | ⋯ menu (stops row click): Open, Delete (opens `DeleteContractDialog`, retention-and-deletion.md) |
| `EmptyState` | — | Card centered: H5 "No contracts reviewed yet", body "Upload your first contract to begin.", primary CTA "Review a Contract" |
| `Pagination` | `page`, `total`, `pageSize` | "Showing 1–20 of 43" + Prev/Next buttons; hidden when total ≤ pageSize |

## 7. Design

Page wrapper per design-tokens.md §4 (`flex-col gap-10`). Table per recipe; header row `bg-surface`. Low-confidence column right-aligned. Mobile (< 640px): table becomes stacked cards (name, badges row, date) — same click behaviour.

## 8. Edge cases

- No contracts → `EmptyState`; summary cards show 0.
- `uploading` rows never shown (view filter).
- Delete last row on page > 1 → navigate to previous page.
- Invalid sort param in URL → defaults.
- Very long names → truncate + tooltip.

## Acceptance criteria

The feature is done when all of these are true:

- [ ] A new user sees the empty state "No contracts reviewed yet" with a Review a Contract button.
- [ ] Summary cards show total reviewed, NDA count and MSA count (completed contracts) (FR-10).
- [ ] The table lists only the user's contracts with name, type, upload date, status and low-confidence count (US-008).
- [ ] Sorting by name, type, date and status works in both directions and survives a page refresh.
- [ ] Clicking a row opens results (or resumes the upload wizard for `ready` contracts).
- [ ] The trial usage meter shows "X of 5 trial analyses used · N days left".

## 9. Tests

- Unit: `listContractsQuerySchema` defaults/invalids; `ContractRow` routes by status; stale mapping.
- Integration: list only own contracts; sort by each column both directions; pagination `total`; uploading excluded; summary counts completed only.
- E2E (`dashboard.spec.ts`): new user empty state → after one processed contract, row visible, sort by name toggles order, row click opens results.
