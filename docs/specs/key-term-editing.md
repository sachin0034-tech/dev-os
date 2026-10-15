# Spec — F07 Inline Key-Term Editing

**Source:** engineering-doc.md §4.8, §9.3 #10 · **Stories:** US-009 · PRD §9 (correction loop)

---

## 1. Scope

Users correct any extracted value inline. Saves < 2 s, shows "Edited" badge, keeps the AI's `original_value` immutable (DB trigger) for the feedback loop, and allows revert.

## 2. Files

| File | Responsibility |
|---|---|
| `src/app/api/key-terms/[id]/route.ts` | PATCH |
| `src/lib/services/key-terms.service.ts` | `editKeyTerm`, `revertKeyTerm` |
| `src/lib/validation/key-terms.ts` | Schema |
| `src/hooks/use-update-key-term.ts` | Optimistic mutation |
| `src/components/key-terms/{editable-value,edited-badge}.tsx` | UI |

DB: `key_terms` column grant `UPDATE (value, is_edited, edited_at)`; trigger `protect_key_term_columns`; view `term_corrections` (database.md).

## 3. Validation

```ts
export const patchKeyTermSchema = z.union([
  z.object({ value: z.string().max(MAX_TERM_VALUE_CHARS, 'At most 2,000 characters') }).strict(),
  z.object({ revert: z.literal(true) }).strict(),
]);
```

## 4. API — PATCH `/api/key-terms/{id}`

`withHandler({ params: idParamSchema, body: patchKeyTermSchema, rateLimit: 'key_term_edit' })`

1. `current = supabase.from('key_terms').select('id, contract_id, value, original_value').eq('id', id).maybeSingle()` → null → `NOT_FOUND`.
2. Edit: `next = body.value.trim() || null`; if `next === current.value` → return current (no write). Update `{ value: next, is_edited: next !== current.original_value, edited_at: next !== current.original_value ? now : null }`.
3. Revert: update `{ value: current.original_value, is_edited: false, edited_at: null }`.
4. Update via user client `.eq('id', id).select(KEY_TERM_COLUMNS).single()`.
5. **200** `KeyTerm`. Errors 400, 401, 404, 429.

## 5. Client — `useUpdateKeyTerm(contractId)`

```ts
useMutation({
  mutationFn: ({ id, body }) => apiFetch<KeyTerm>(`/api/key-terms/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  onMutate: async ({ id, body }) => {
    await qc.cancelQueries({ queryKey: ['contract', contractId] });
    const prev = qc.getQueryData<ContractDetailResponse>(['contract', contractId]);
    qc.setQueryData(['contract', contractId], patchTerm(prev, id, body));   // optimistic value/isEdited
    return { prev };
  },
  onError: (_e, _v, ctx) => { qc.setQueryData(['contract', contractId], ctx?.prev); toast.error("Couldn't save your edit. Try again."); },
  onSuccess: (term) => qc.setQueryData(['contract', contractId], replaceTerm(term)),
});
```

## 6. Components

| Component | Props | Behaviour |
|---|---|---|
| `EditableValue` | `term`, `onSave(value)`, `onRevert()`, `saving` | **View:** value text (or "Not found in document") + ghost icon button `Pencil` (`aria-label="Edit {termName}"`); clicking value also enters edit. **Edit:** auto-growing `<textarea>` (min 2 rows, max 8), `maxLength=2000`, counter "{n}/2000" when n > 1800; buttons Save (primary sm) / Cancel (ghost sm); Enter = save, Shift+Enter = newline, Esc = cancel; focus returns to the pencil button after exit |
| `EditedBadge` | `originalValue` | Info badge "Edited" with tooltip "Original AI value: {originalValue ?? 'Not found'}" |
| Card menu (in `KeyTermCard`) | — | `DropdownMenu` (⋯) with "Revert to AI value" when `isEdited` |

Confidence badge and low-confidence warning remain as the AI produced them (they describe the AI extraction, not the user's value). When `isEdited`, `LowConfidenceWarning` is hidden (the user has verified it).

## 7. Edge cases

- Unchanged value → no request.
- Edit back to original text → `is_edited = false`, badge disappears.
- Clearing to empty → stored `null`, shown as "Not found in document", `is_edited = true`.
- Two tabs editing → last write wins.
- Attempt to change `original_value` via direct Supabase call → permission denied (column grant) — covered by integration test.
- Rate limit 120/min → 429 toast.

## Acceptance criteria

The feature is done when all of these are true:

- [ ] Clicking a value (or the pencil) opens an inline editor; Enter saves, Esc cancels.
- [ ] A saved edit persists after reload within 2 seconds and shows an "Edited" badge whose tooltip shows the original AI value (US-009).
- [ ] "Revert to AI value" restores the original and removes the badge.
- [ ] The original AI value can never be changed, even via a direct database call with the user's token.
- [ ] Edited terms appear in the `term_corrections` view.
- [ ] A failed save rolls back the value and shows a toast.

## 8. Tests

- Unit: `patchKeyTermSchema` union; `EditableValue` keyboard behaviour (Enter/Shift+Enter/Esc).
- Integration: edit sets `is_edited` + `edited_at`; revert restores; editing to original clears flag; other user's term → 404; direct `update original_value` with user JWT → error; `term_corrections` view lists edited rows.
- E2E (`edit.spec.ts`): edit value → "Edited" badge → reload → persists → revert → badge gone.
