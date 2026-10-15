# Spec — F10 Feedback

**Source:** engineering-doc.md §4.10, §9.3 #13 · **Stories:** US-010 · **FR:** FR-12

---

## 1. Scope

On a completed contract's key-terms panel, the user rates the results 👍/👎 with an optional comment (≤ 1,000 chars). One feedback row per user per contract; resubmitting updates it.

## 2. Files

| File | Responsibility |
|---|---|
| `src/app/api/contracts/[id]/feedback/route.ts` | POST |
| `src/lib/services/feedback.service.ts` | `upsertFeedback` |
| `src/lib/validation/feedback.ts` | Schema |
| `src/hooks/use-submit-feedback.ts` | Mutation |
| `src/components/feedback/feedback-widget.tsx` | UI |

DB: `user_feedback` (unique `contract_id, user_id`; RLS select/insert/update own).

## 3. Validation

```ts
export const feedbackSchema = z.object({
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().transform((s) => s.trim()).pipe(z.string().max(MAX_FEEDBACK_COMMENT_CHARS)).optional()
    .transform((s) => (s ? s : null)),
});
```

## 4. API — POST `/api/contracts/{id}/feedback`

`withHandler({ params: idParamSchema, body: feedbackSchema, rateLimit: 'feedback' })`
1. Contract (RLS) → `NOT_FOUND`; status ≠ `completed` → `INVALID_STATE`.
2. `supabase.from('user_feedback').upsert({ contract_id: id, user_id, rating, comment }, { onConflict: 'contract_id,user_id' }).select('rating, comment, updated_at').single()`.
3. **200** `{ rating, comment, updatedAt }`. Errors 400, 401, 404, 409, 429.

## 5. Component — `FeedbackWidget`

Props: `contractId`, `initial: { rating, comment } | null`.

States:
1. **Ask:** body-lg "Were these results accurate?" + two toggle buttons (`ThumbsUp`, `ThumbsDown`, `aria-pressed`, labels "Yes" / "No").
2. **Comment:** after selecting a rating → textarea (placeholder "Tell us what was wrong or right (optional)", maxLength 1000, counter > 900) + Submit (primary sm) + Cancel.
3. **Thanks:** "Thanks for your feedback." + "Change" link → back to state 2 with current values.
Initial data present → starts in Thanks with the selected thumb highlighted.

Mutation `useSubmitFeedback(contractId)` updates `['contract', id].feedback` on success; error → toast "Couldn't send feedback. Try again."

## 6. Design

Section at bottom of key-terms list: `border-t border-default pt-4 mt-2`. Selected thumb: `bg-brand-tint text-brand border-brand`. Unselected: secondary button.

## 7. Edge cases

- Rating without comment → allowed.
- Comment > 1,000 → blocked client-side; server 400.
- Feedback on non-completed contract → widget not rendered; server 409.
- Contract deleted → feedback cascades.

## Acceptance criteria

The feature is done when all of these are true:

- [ ] On a completed contract the user can choose 👍 or 👎 and optionally add a comment ≤ 1,000 characters (US-010, FR-12).
- [ ] Submitting shows "Thanks for your feedback"; the choice is still selected after reload.
- [ ] Changing the rating updates the same record (one per user per contract).
- [ ] Feedback is not available on contracts that haven't finished processing.

## 8. Tests

- Integration: create then update (same row, `updated_at` changes); comment trimmed/empty → null; non-completed → 409; other user → 404.
- Component: state transitions, `aria-pressed`.
