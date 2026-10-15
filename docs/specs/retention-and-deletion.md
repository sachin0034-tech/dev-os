# Spec — F12 Data Retention & Deletion

**Source:** engineering-doc.md §4.11, §9.3 #5, #15 · PRD §5 (90-day retention, user deletion, GDPR)

---

## 1. Scope

- User deletes a contract → Storage object + all DB rows (cascade). Quota ledger kept (contract reference nulled).
- Daily cron (03:00 UTC): delete PDFs not accessed for 90 days (keep extracted text), remove abandoned uploads, reset stale processing, prune rate-limit rows, check daily cost.
- Account deletion (GDPR request), manual operator procedure in MVP:
  1. Supabase Dashboard → Storage → `contracts` bucket → select folder `{user_id}` → Delete (removes all of the user's PDFs).
  2. Authentication → Users → find the user → Delete user (cascades `profiles`, `contracts` and all child rows, `usage_events`, `chat_*`, `user_feedback`).
  3. Record the request date and completion in the GDPR request log (docs/security, Stage 7).
- Storage objects orphaned by a failed removal in §3 step 3 are logged as `storage.orphan` events and deleted by hand from the Storage UI using the logged path.

## 2. Files

| File | Responsibility |
|---|---|
| `src/app/api/contracts/[id]/route.ts` | DELETE |
| `src/app/api/cron/retention/route.ts` | GET (cron) |
| `src/lib/services/contracts.service.ts` | `deleteContract` |
| `src/lib/services/retention.service.ts` | `runRetention` |
| `src/hooks/use-delete-contract.ts` | Mutation |
| `src/components/contracts/delete-contract-dialog.tsx` | UI |
| `vercel.json` | Cron schedule `0 3 * * *` |

## 3. API — DELETE `/api/contracts/{id}`

`withHandler({ params: idParamSchema })`
1. Contract (RLS) select `id, status, file_path, processing_started_at` → `NOT_FOUND`.
2. `status === 'processing'` and not stale → `INVALID_STATE`.
3. If `file_path`: `admin.storage.from('contracts').remove([file_path])` — on error log `storage.orphan { path }` and continue.
4. `supabase.from('contracts').delete().eq('id', id)` (RLS delete-own; cascades `custom_key_terms`, `key_terms`, `chat_sessions` → `chat_messages`, `user_feedback`; `usage_events.contract_id` → NULL).
5. **204**. Errors 401, 404, 409.

## 4. Cron — GET `/api/cron/retention`

`withHandler({ auth: false })` then:
```ts
const auth = req.headers.get('authorization') ?? '';
const expected = `Bearer ${env.CRON_SECRET}`;
if (auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) throw new AppError('UNAUTHORIZED_CRON');
```
`runRetention()` — each job in its own try/catch; batches of 100 until none left or 50 s elapsed:

| # | Job | Query / action |
|---|---|---|
| 1 | Expire PDFs | `select id, file_path from contracts where file_path is not null and last_accessed_at < now() - interval '90 days' limit 100` → `storage.remove(paths)` → `update contracts set file_path = null, pdf_deleted_at = now() where id in (...)` |
| 2 | Abandoned uploads | `select id, user_id from contracts where status = 'uploading' and created_at < now() - interval '24 hours'` → remove `{user_id}/{id}/source.pdf` (ignore missing) → delete rows |
| 3 | Stale processing | `update contracts set status = 'error', error_code = 'STALE_PROCESSING', error_message = 'Analysis was interrupted. Try again.' where status = 'processing' and processing_started_at < now() - interval '10 minutes'` |
| 4 | Prune rate limits | `delete from rate_limits where window_start < now() - interval '1 day'` |
| 5 | Cost check | `select coalesce(sum(cost_usd),0) from usage_events where created_at > now() - interval '24 hours'` → if > `COST_ALERT_DAILY_USD` → `logger.error('cost.alert', { spend24h, threshold })`; always `logger.info('cost.daily', { spend24h, analyses24h, p95CostPerAnalysis })` |

Response **200** `{ pdfsDeleted, abandonedUploads, staleReset, rateLimitRowsPruned, spend24hUsd }`; log `retention.run`.

All DB work uses the admin client. Jobs are idempotent.

## 5. Client

`useDeleteContract()`:
```ts
mutationFn: (id) => apiFetch(`/api/contracts/${id}`, { method: 'DELETE' }),
onSuccess: (_d, id) => { qc.removeQueries({ queryKey: ['contract', id] }); qc.invalidateQueries({ queryKey: ['contracts'] }); toast.success('Contract deleted'); router.push('/dashboard'); }
```

`DeleteContractDialog` (Radix AlertDialog) props `contractId`, `fileName`, `open`, `onOpenChange`: title "Delete this contract?"; body "This permanently deletes **{fileName}**, its key terms and chat history. This can't be undone."; Cancel (secondary, initial focus) / "Delete permanently" (destructive, spinner while pending). Entry points: dashboard row menu, results header menu.

## 6. Design

Dialog per design-tokens.md §5, destructive button `bg-danger`.

## 7. Edge cases

- Delete during processing → 409 with message; button disabled with tooltip "Wait for analysis to finish".
- Storage removal fails → rows still deleted; orphan logged.
- Retention removes a PDF currently open → next URL fetch 410 → text viewer (retention banner).
- Viewing a contract resets its 90-day clock (`last_accessed_at` on GET detail).
- Cron called without/incorrect secret → 401.

## Acceptance criteria

The feature is done when all of these are true:

- [ ] Deleting a contract (dashboard or results page) asks for confirmation, then removes the contract, key terms, custom terms, chat and feedback, and its PDF; quota usage is kept.
- [ ] A contract cannot be deleted while it is processing.
- [ ] The daily job deletes PDFs not viewed for 90 days; those contracts still open in the text viewer with the retention banner.
- [ ] Abandoned uploads older than 24 h are removed; processing stuck > 10 min becomes Try again.
- [ ] The cron endpoint rejects requests without the correct `CRON_SECRET` (401).

## 8. Tests

- Integration: delete cascades all child rows, keeps `usage_events` with null `contract_id`; other user's contract → 404; processing → 409; cron without secret → 401; cron with seeded old contract → `file_path` null + `pdf_deleted_at` set; abandoned upload removed; stale processing reset; rate_limits pruned.
- E2E: delete from dashboard menu → row gone, toast shown.
