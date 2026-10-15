# ContractIQ — Implementation Specs (per feature)

| Field | Value |
|---|---|
| Companion to | `docs/engineering/engineering-doc.md` v1.0 |
| Date | 2026-10-10 |
| Status | Draft — awaiting approval (Stage 1) |

Each block covers: **User flow · DB schema · DB tasks · API routes · State management · Component spec · Design · Edge cases.**

Section references (§) point to `engineering-doc.md`. Design tokens come from `docs/design.md` and are referenced by semantic name (`text-primary`, `text-secondary`, `bg-surface`, `bg-primary`, `bg-subtle`, `brand`, `success-*`, `warning-*`, `danger-*`, `accent-*`).

**Build order:** F01 → F13 (landing only) → F02 → F04 → F05 → F03 → F06 → F07 → F09 → F08 → F11 → F10 → F12 → F13 (onboarding).

---

## F01 — Authentication

**User flow**
1. `/` → "Get Started Free" → `/signup` → submit email and password → `/signup/check-email` ("We sent a link to {email}", plus a Resend button with a 60 s cooldown).
2. Click the email link → `/auth/callback?code=` → session cookie set → `/dashboard`.
3. `/login` → submit → `/dashboard` (or the sanitized `?next=`).
4. User menu → Sign out → `/`.

**DB schema:** `profiles` (§7.3), trigger `on_auth_user_created` → `handle_new_user()`.

**DB tasks**
- Create `profiles` + RLS (SELECT/UPDATE own) + column grants (`full_name`, `onboarding_completed_at` only).
- Create the SECURITY DEFINER `handle_new_user()`: `INSERT INTO public.profiles(id, email) VALUES (NEW.id, NEW.email)`.
- Supabase Auth settings:
  - Confirm email ON.
  - Site URL = `APP_URL`; redirect allow-list includes `${APP_URL}/auth/callback`.
  - Minimum password length 8.

**API routes**
- Server actions in `src/app/(auth)/actions.ts`: `signUp`, `signIn`, `signOut`, `resendVerification` (§9.1).
- `GET /auth/callback`.
- Zod: `signUpSchema`, `signInSchema` in `lib/validation/auth.ts`.

**State management**
- No global store. Forms use react-hook-form plus `useFormState` for server-action errors.
- Session state lives in cookies; server components read it with `createServerClient().auth.getUser()`.

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `AuthCard` | `title`, `subtitle`, `children`, `footer` | Centered 400 px card on `bg-surface` |
| `SignupForm` | — | Email, password with show/hide toggle, password rules checklist (live), submit; maps server error codes to field or form errors |
| `LoginForm` | `next?: string`, `initialError?: string` | Email, password, "Forgot password?" (Phase 2; hidden), submit; shows a Resend link for `EMAIL_NOT_CONFIRMED` |
| `UserMenu` | `email` | DropdownMenu showing the email and a Sign out item |

**Design**
- Card: `bg-primary`, 8 px radius, 32 px padding, 24 px gap between fields.
- Inputs: 6 px radius, Grey 100 border, 2 px `brand` focus.
- Primary button: full width, `brand`.
- Errors: Red 700 text at 12/18 below the field, with a Red 500 border.

**Edge cases**
- Already signed in and visiting `/login` → redirect to `/dashboard`.
- `next=//evil.com` → ignored.
- Expired or used verification code → `/login?error=link_expired` with a resend option.
- Signing up again with an unconfirmed email → Supabase resends; show the same check-email screen.
- Auth rate limit from Supabase → `RATE_LIMITED` message.
- Auth must complete in under 10 s; show a spinner after 300 ms.

---

## F02 — Upload & Text Extraction

**User flow:** §4.4. Step 1: choose type → drop a PDF → upload progress → "Extracting text…" → ready. The wizard advances to the preview (F03) with the Process button enabled.

**DB schema:** `contracts` (§7.3), enums `contract_type` and `contract_status`; Storage bucket `contracts` + 3 policies (§7.4).

**DB tasks**
- Create the enums, the `contracts` table with CHECK constraints and 4 indexes, RLS (4 policies), column grants and the `set_updated_at` trigger.
- `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('contracts','contracts', false, 10485760, '{application/pdf}') ON CONFLICT DO NOTHING`.
- 3 policies on `storage.objects` (INSERT, SELECT, DELETE) using `(storage.foldername(name))[1] = auth.uid()::text`.

**API routes:** `POST /api/contracts/init`, `POST /api/contracts/{id}/extract` (§9.3 #1–2).

Server logic in `contracts.service.ts`:

```ts
initContract(user, { fileName, fileSize, contractType })
  // assertRateLimit('upload_init'), assertQuota(user)
  // insert status='uploading' (service role after auth), storage.createSignedUploadUrl(path)
extractContract(user, id, source: { mode: 'storage' } | { mode: 'direct', file: Buffer })
  // load contract (user client) → 404 if absent; 409 unless status='uploading'
  // buffer = mode==='storage' ? storage.download(path) : file
  // assertPdf(buffer); { text, pageCount, wordCount } = extractPdfText(buffer)
  // tokenCount = countTokens(text)
  // validate → on failure: storage.remove(path) (ignore errors), delete contract, throw
  // update: contract_text, page_count, word_count, token_count,
  //         file_path = mode==='storage' ? path : null, status = 'ready'
```

`lib/pdf/extract-text.ts`:
- `pdf-parse(buffer, { pagerender })`. The custom `pagerender` joins text items, inserting line breaks when `transform[5]` changes.
- Output: `[PAGE 1]\n…\n\n[PAGE 2]\n…`. The page count comes from `numpages`.
- Encrypted or corrupt input → `PDF_UNREADABLE`.

`lib/pdf/page-markers.ts`:
- `splitPages(text): { page: number, text: string }[]`
- `findPageOf(text, needle): number | null`

**State management**
- `useUploadStore` (Zustand): `{ step: 'select'|'uploading'|'extracting'|'preview'|'processing'|'error', contractType, contractId, file, progress, error }`.
- `useUploadContract()` (TanStack mutation) runs the steps in order: init → `uploadToSignedUrl` (progress via XHR) → extract. On a Storage error with `file.size <= maxDirectUploadBytes`, it retries extract in multipart mode.
- `?resume={id}` loads the contract and jumps to `preview` when its status is `ready`.

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `ContractTypeSelect` | `value`, `onChange`, `disabled` | shadcn Select with options NDA ("Non-Disclosure Agreement") and MSA ("Master Service Agreement"); required before the drop zone is enabled |
| `PdfDropzone` | `disabled`, `onFile(file)` | Drag-and-drop plus a keyboard-accessible "Choose file" button; accepts `.pdf`; client checks type and ≤ 10 MB; shows a hint ("PDF up to 10 MB, 20 pages, text-based (not scanned)") |
| `UploadProgress` | `fileName`, `progress`, `phase: 'uploading'\|'extracting'` | Progress bar, then an indeterminate "Extracting text…" state; Cancel button available during upload |
| `UploadError` | `code`, `onRetry` | Maps the code to its catalog message (§9.4) |

**Design**
- Dropzone: dashed 1 px Grey 200 border, `bg-surface`, 8 px radius, 48 px padding.
- Drag-over: Blue 50 background with a Blue 500 border.
- File row: labelled value pattern (name 16/24 Medium; size and page count 12/18 `text-secondary`).

**Edge cases**
- A `.pdf` extension on a non-PDF file → server `NOT_A_PDF`.
- Password-protected PDF → `PDF_UNREADABLE`.
- Exactly 20 pages is OK; 21 is rejected.
- 99 words → `SCANNED_PDF`.
- The user closes the tab mid-upload → the row stays `uploading`; the cron deletes it after 24 h.
- Double-dropping a file is ignored while a step is in flight.
- File names with emoji or path separators are sanitized.
- Mobile under 640 px → advisory banner.
- Storage policy missing (PRD Assumption 13) → the upload fails → direct mode if ≤ 4 MB, otherwise "Upload failed. Try again."

---

## F03 — Key-Term Preview & Custom Terms

**User flow:** §4.5. The preview appears as soon as a type is selected, so the user can add custom terms while upload and extraction are still running. Terms are persisted only once a `contractId` exists; anything added earlier is queued in the store and flushed after init.

**DB schema:** `custom_key_terms` (§7.3).

**DB tasks**
- Create the table, a unique index on `(contract_id, lower(term_name))`, RLS (SELECT/INSERT/DELETE own, with an ownership check on INSERT).
- Trigger function `enforce_custom_term_limit()`: `IF (SELECT count(*) FROM custom_key_terms WHERE contract_id = NEW.contract_id) >= 5 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CUSTOM_TERM_LIMIT'`.

**API routes**
- `POST /api/contracts/{id}/custom-terms` and `DELETE /api/contracts/{id}/custom-terms/{termId}` (§9.3 #6–7).
- The service maps Postgres `23505` → `CUSTOM_TERM_DUPLICATE` and `P0001/CUSTOM_TERM_LIMIT` → 422.
- `term_key` = `custom_` + slugified name.

**State management**
- `useUploadStore.customTerms: { tempId, id?, termName, status: 'queued'|'saving'|'saved'|'error' }[]`.
- Mutations `useAddCustomTerm` and `useRemoveCustomTerm` are optimistic.
- `STANDARD_TERMS[type]` is imported directly.

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `KeyTermPreview` | `contractType`, `customTerms`, `onAdd`, `onRemove`, `locked` | Card titled "Terms we'll look for" with a 2-column list; standard terms show an (i) tooltip definition |
| `TermPreviewItem` | `name`, `isCustom`, `onRemove?` | Name; "Custom" badge (accent) and a remove (×) button with aria-label "Remove {name}" |
| `AddCustomTermInput` | `existingNames`, `onSubmit`, `disabled` | "+ Add Key Term" button → inline input, Enter to add, Esc to cancel; counter "2/5"; inline validation errors |

**Design**
- Card: `bg-primary`, 8 px radius, 24 px padding, H5 title.
- List items: 16/24 Medium with an 8 px row gap.
- Custom badge: Violet 50 bg, Violet 200 border, Violet 700 text, 4 px radius, 2×8 px padding.

**Edge cases**
- Case-insensitive duplicates (including against standard names, e.g. "governing law").
- A sixth term → the button is disabled and the API also rejects it.
- Whitespace-only input is rejected.
- Adding a term after processing has started → 409; the preview is locked.
- Custom terms queued before init fail to flush → shown with an error and a retry.
- Removing a term that's still saving → the remove is queued until the save resolves.

---

## F04 — AI Extraction Pipeline

**User flow:** §4.6. Process → 3-step progress → results. Failure shows an error card with "Try again".

**DB schema:** `key_terms`, `usage_events` (§7.3); RPC `replace_key_terms`.

**DB tasks**
- Create `key_terms`: unique `(contract_id, term_key)`, indexes, RLS (SELECT/UPDATE own), column grants, `protect_original_value` trigger.
- Create `usage_events` with RLS (SELECT own only) and its index.
- Create `replace_key_terms(p_contract_id, p_user_id, p_terms jsonb)` as a SECURITY DEFINER function, EXECUTE granted to `service_role` only. It deletes the existing rows and inserts from `jsonb_to_recordset`, setting `original_value = value`.

**API routes:** `POST /api/contracts/{id}/process` (§9.3 #8), `export const maxDuration = 90`.

`extraction.service.processContract(user, id)`:
1. Ownership via the user client.
2. `assertRateLimit('process', 10, 3600)`, then `assertQuota(user)`.
3. Atomic claim (§4.6); 0 rows → 409.
4. Load `contract_text`, `page_count`, `contract_type` and custom terms.
5. `requested = [...STANDARD_TERMS[type], ...custom]`.
6. `buildExtractionMessages({ type, requested, contractText })`, then `withRetry(() => openai.chat.completions.create({ model, temperature: 0.1, max_tokens: 2000, response_format: { type: 'json_schema', json_schema: EXTRACTION_SCHEMA }, user: hash(user.id), messages }), { attempts: 3 })` with an `AbortSignal.timeout(25000)` per attempt.
7. `parseExtraction(content)`: Zod. On failure, make one repair call.
8. `validateTerms(raw, { requested, contractText, pageCount })` (§8.4).
9. `rpc('replace_key_terms')`.
10. Update the contract to `completed` with timings and `prompt_version`.
11. `logUsage({ success: true, … })`.
12. **Catch:** update the contract to `error` with `error_code`/`error_message`, `logUsage({ success: false })`, then rethrow the mapped `AppError`.

**State management**
- `useProcessContract(id)` mutation drives the `ProcessingProgress` steps: on start step 2 is active, on success step 3 ticks, then `router.replace`.
- `useContract(id)` sets `refetchInterval: (q) => q.state.data?.contract.status === 'processing' ? 2000 : false`.

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `ProcessButton` | `disabled`, `onClick`, `loading` | Label "Process Contract"; disabled unless status = `ready` and no custom-term saves are pending |
| `ProcessingProgress` | `activeStep: 1\|2\|3`, `elapsedMs` | 3 labelled steps with ✓ / spinner / ○ icons; `aria-live`. After 30 s: "Taking longer than usual…" |
| `ProcessingError` | `code`, `onRetry`, `retrying` | Error card using the §9.4 message; "Try again"; for `QUOTA_EXCEEDED` it renders `QuotaExceededCard` instead |

**Design**
- Stepper: vertical, with an 8 px gap between steps.
- Active step: `brand` spinner. Done: Green 500 check. Pending: Grey 300 circle.
- Error card: Red 50 bg, Red 200 border, Red 700 title.

**Edge cases**
- Double-click or two tabs → the second gets 409 and simply polls.
- The model returns duplicate `term_key`s → keep the one with the highest confidence.
- `value` given as an empty string → normalized to null.
- Non-integer confidence → rounded and clamped to 0–100.
- The contract is deleted mid-process → the RPC fails on the FK → error, swallowed (404).
- An OpenAI 400 (context too long, which shouldn't happen given the 15k cap) → `AI_INVALID_OUTPUT`, no retry.
- The serverless function times out at 90 s → the row stays `processing` → treated as stale after 3 min; the user can retry.
- Failed runs never consume quota.

---

## F05 — Results Page & Key-Terms Panel

**User flow:** §4.7. Two-pane results; the right panel lists terms ordered by `display_order` (standard order, then custom). A summary row shows "8 high · 3 medium · 1 low confidence"; clicking a band filters the list.

**DB schema:** reads `contracts`, `key_terms`, `custom_key_terms`, `user_feedback`.

**DB tasks:** none new; uses `key_terms_contract_order_idx`.

**API routes**
- `GET /api/contracts/{id}` (§9.3 #4). The server component calls `contracts.service.getDetail` directly for the first render; the client hydrates TanStack Query with `initialData`.
- `confidenceBand`: ≥ 80 `high`, 50–79 `medium`, < 50 `low` (`lib/utils/confidence.ts`; the same function is used server- and client-side).

**State management**
- `useContract(id)` provides the server data.
- `useResultsUiStore` (Zustand) holds `{ activeTab: 'terms'|'chat', bandFilter: 'all'|'high'|'medium'|'low', expandedWhy: Set<string> }`.
- Viewer navigation goes through `useViewerStore` (F06).

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `ResultsLayout` | `contract`, `keyTerms`, `hasPdf` | Responsive 2-pane / tabbed layout (§5.4); header shows file name, type badge, page count, processed date, and a Delete action |
| `DisclaimerBanner` | — | "This is an AI-assisted review tool, not legal advice. Always verify critical terms with a qualified lawyer." Not dismissible; `role="note"` |
| `KeyTermsSummary` | `terms`, `filter`, `onFilter` | 3 toggle chips with counts |
| `KeyTermCard` | `term: KeyTerm`, `onNavigate(page, text)` | Term name (16/24 Medium) + glossary tooltip; badges (Custom, Edited); `EditableValue`; footer row with `PageLink`, `ConfidenceBadge` and the "Why?" toggle |
| `ConfidenceBadge` | `score` | Shows "92% · High" / "64% · Medium" / "31% · Low" with icons (check / dash / ⚠️) |
| `LowConfidenceWarning` | — | Shown when score < 50: ⚠️ + "Low confidence — we recommend verifying this in the document directly." Always visible inline (not hover-only) so it's non-dismissible and accessible |
| `PageLink` | `page: number\|null`, `onClick` | "p. 4" button; `null` → "Page not identified" (disabled) |
| `WhyAccordion` | `sourceSentence`, `page` | Expands a quote block (left 2 px Grey 200 border, 12 px padding, 16/24 italic-free Medium), with "Page N" caption |

**Design**
- Panel background `bg-surface`; cards `bg-primary`, 8 px radius, 16 px padding, 8 px gap between cards. No shadows.
- Not-found value: `text-secondary` "Not found in document".
- Badge styles per §5.5.
- Header title: H5.

**Edge cases**
- All terms not found (e.g. an uploaded invoice) → top notice: "Most terms weren't found. Is this an {NDA|MSA}?" (soft type-mismatch warning, PRD §3).
- 0 key terms because the contract is still `ready` → redirect to `/contracts/new?resume=id`.
- `error` status → show `ProcessingError` in the panel with Try again.
- A very long value is clamped to 6 lines with "Show more".
- A foreign or unknown ID → `not-found.tsx`.

---

## F06 — Contract Viewer (PDF + Text Fallback)

**User flow**
- The left pane loads the PDF from the signed URL.
- Toolbar: zoom −/+ (50–200%, step 25%), fit width, page "4 / 12", download link.
- Clicking a page reference scrolls to that page and highlights the source sentence for 3 s.
- If the PDF is unavailable, the text viewer shows the same pages as labelled sections.

**DB schema:** reads `contracts.file_path` and `contract_text`.

**DB tasks:** none.

**API routes**
- `GET /api/contracts/{id}/pdf-url` (§9.3 #9).
- `GET /api/contracts/{id}?include=text` returns `contractText` for the fallback (fetched lazily, only when the fallback activates).

**State management**
- `useViewerStore`: `{ targetPage: number|null, highlightText: string|null, navNonce: number, zoom: number, currentPage: number, mode: 'pdf'|'text', userHasNavigated: boolean, setTarget(page, text), setMode(m) }`. `navNonce` makes clicking the same page twice re-trigger the scroll.
- `usePdfUrl(id, enabled)` (TanStack, `staleTime` 50 min, refetches on 403 from Storage).

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `DocumentPane` | `contractId`, `hasPdf`, `pageCount` | Chooses the mode: `pdf` if `hasPdf` and the URL resolves; on 410/503 or a render `onLoadError`, switches to `text` and shows `ViewerFallbackBanner` |
| `PdfViewer` | `url`, `targetPage`, `highlightText`, `navNonce`, `zoom` | `react-pdf` `Document` + virtualized `Page`s (renders ±2 around the viewport via IntersectionObserver). On `targetPage` change: `scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })`. `customTextRenderer` wraps the normalized `highlightText` match in `<mark>` on the target page |
| `ContractTextViewer` | `text`, `targetPage`, `highlightText`, `navNonce` | `splitPages(text)` → `<section aria-label="Page N">` with a sticky "Page N" label; same scroll/highlight behavior |
| `PdfToolbar` | `page`, `pageCount`, `zoom`, `onZoom`, `downloadUrl?` | Keyboard accessible; the download link is hidden in text mode |
| `ViewerFallbackBanner` | `reason` | Yellow-tinted note: "PDF preview unavailable — showing extracted text." |

**Design**
- Viewer background Grey 50; pages are white with a 1 px Grey 100 border and a 16 px gap.
- Highlight: Yellow 200 background, fading to transparent over 3 s (300 ms ease-in-out at the end).
- Toolbar: 48 px high, `bg-primary`, with a bottom Grey 100 divider.

**Edge cases**
- The signed URL expires while open → a Storage 403 triggers a refetch of the URL.
- Fonts render incorrectly → the user can switch to "View as text" via a toolbar toggle.
- The highlight text isn't found on the page (PDF text-layer differences) → scroll only, no highlight.
- `pageNumber` null → no navigation.
- The PDF was deleted by retention → 410 → text mode.
- Large PDFs (10 MB) → lazy rendering; a placeholder skeleton for each page.

---

## F07 — Inline Term Editing

**User flow:** §4.8.

**DB schema:** `key_terms.value`, `original_value`, `is_edited`, `edited_at`; view `term_corrections`.

**DB tasks**
- Trigger `protect_original_value` (BEFORE UPDATE: `NEW.original_value := OLD.original_value; NEW.term_key := OLD.term_key; NEW.contract_id := OLD.contract_id; NEW.user_id := OLD.user_id`).
- `GRANT UPDATE (value, is_edited, edited_at) ON key_terms TO authenticated`.
- Create the view `term_corrections` with `security_invoker`.

**API routes**
- `PATCH /api/key-terms/{id}` (§9.3 #10).
- Service: edit → `{ value: trimmed || null, is_edited: value !== original_value, edited_at: now() }`; revert → `{ value: original_value, is_edited: false, edited_at: null }`.

**State management**
- `useUpdateKeyTerm(contractId)` uses an optimistic `setQueryData` on `['contract', id]`, rolls back on error and invalidates on settle.

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `EditableValue` | `term`, `onSave(value)`, `onRevert()` | View mode: value + pencil button (aria-label "Edit {term}"). Edit mode: auto-growing textarea (max 2,000 chars, counter shown above 1,800), Save / Cancel; Enter saves (Shift+Enter for a newline), Esc cancels; saving state |
| `EditedBadge` | `originalValue` | "Edited" badge; tooltip "Original AI value: {originalValue}" plus a "Revert" action in the card menu |

**Design**
- Textarea: 6 px radius, 2 px `brand` focus.
- Edited badge: Blue 50 / 200 / 700.
- Save: small primary button. Cancel: ghost button.

**Edge cases**
- Saving an unchanged value → no request.
- Editing a value back to the original → `is_edited=false`.
- Clearing the value to empty → stored as null ("Not found in document") with `is_edited=true`.
- Concurrent edits in two tabs → last write wins.
- The save must complete in under 2 s; a toast on failure.
- Confidence is not changed by edits (it reflects the AI's output).

---

## F08 — Contract Chat

**User flow:** §4.9.
- Chat tab → history or suggested questions (NDA: "What counts as confidential information?", "How long do the obligations last?", "What happens if I breach this?"; MSA: "Is there an auto-renewal clause?", "What is the liability cap?", "How can either party terminate?").
- Type a question → the answer streams in → citation chips.

**DB schema:** `chat_sessions`, `chat_messages` (§7.3).

**DB tasks**
- Create both tables, enum `chat_role`, the index `(session_id, created_at)`, RLS:
  - sessions: SELECT/INSERT own
  - messages: SELECT own; INSERT own with `role='user'` only
- Assistant inserts use the service role.

**API routes:** `GET` and `POST /api/contracts/{id}/chat` (§9.3 #11–12), `maxDuration = 60`.

`chat.service.streamAnswer(user, contractId, { message, retryOfMessageId })`:
1. Rate limits: `chat:30/60s`, `chat_daily:300/86400s`.
2. Contract must have text.
3. `getOrCreateSession` uses `INSERT … ON CONFLICT (contract_id) DO NOTHING RETURNING`, falling back to a SELECT.
4. Insert the user message, unless `retryOfMessageId` refers to the user's last user message.
5. `history = last 200 ASC`, excluding the current one; trim to 20k tokens.
6. `queryType = classifyQuery(message)`.
7. `messages = buildChatMessages({ contractText, contractType, history, message, queryType })`.
8. Open the OpenAI stream (`temperature 0.4`, `max_tokens 1000`, `stream_options.include_usage`).
9. Return a `ReadableStream` that emits SSE.
10. On finish: `citedPages = parseCitations(full).filter(1..pageCount)`; `missingCitation = queryType !== 'history' && !isNotFound(full) && citedPages.length === 0`.
11. Insert the assistant row and `usage_events`, then emit `done`.
12. On `request.signal` abort, persist the partial answer with `is_partial`.

**State management**
- `useChatHistory(contractId)` (TanStack query `['chat', id]`).
- `useChatStream(contractId)` holds local state `{ streamingText, status: 'idle'|'streaming'|'error', error }`. It parses SSE with `lib/utils/sse.ts`. On `done` it appends the final message to the query cache; on `error` it keeps the user message and offers Retry.
- Citation click → `useViewerStore.setTarget(page, null)`.
- On mobile it also switches the tab to Document.

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `ChatTab` | `contractId`, `contractType`, `pageCount` | Container; auto-scrolls to the bottom unless the user has scrolled up ("New messages ↓" pill) |
| `ChatMessageList` | `messages`, `streaming` | `role="log"` `aria-live="polite"` |
| `ChatBubble` | `message`, `onCitationClick` | User bubbles right-aligned (Blue 50 bg); assistant bubbles left-aligned (`bg-primary`, Grey 100 border). Renders `[Page X]` tokens inline as `CitationChip`s; partial or missing-citation notes in 12/18 `text-secondary` |
| `CitationChip` | `page`, `onClick` | "Source: Page X" pill button |
| `SuggestedQuestions` | `contractType`, `onPick` | 3 chips; hidden once the history has messages |
| `ChatComposer` | `onSend`, `disabled` | Textarea (1–2,000 chars, counter above 1,800); Enter sends, Shift+Enter for a newline; Send disabled while streaming; a Stop button aborts the stream |

**Design**
- Bubbles: 8 px radius, 12 px padding, 16/24 Medium text, 8 px vertical gap, max width 85%.
- Chips: 4 px radius, Blue 50 / 200 / 700.
- Composer: sticky bottom, `bg-primary`, top Grey 100 divider, 12 px padding.

**Edge cases**
- A question about something absent → "I cannot find this in the document." with no missing-citation note.
- Prompt-injection text in the contract or message → system rules restate document-only (deeper controls in Stage 7).
- A history question ("what did you say earlier about termination?") → `history` mode; no citation required.
- More than 200 messages → only the latest 200 are sent; the UI loads older ones with "Load earlier".
- Citation page > pageCount → dropped.
- Network drop mid-stream → partial saved; Retry re-asks.
- The chat works even if the PDF is gone (text only).
- Chat is allowed before processing completes (needs text only) and doesn't consume quota.

---

## F09 — Dashboard & History

**User flow:** §4.3.

**DB schema:** `contracts` (reads), `key_terms` (low-confidence count).

**DB tasks**
- Ensure the `contracts_user_created_idx` and `contracts_user_type_idx` indexes exist.
- Optional SQL view `contract_list_items` (`security_invoker`) adds `low_confidence_count` via a `LEFT JOIN LATERAL (SELECT count(*) FROM key_terms WHERE contract_id = c.id AND confidence_score < 50)`.

**API routes**
- `GET /api/contracts` (§9.3 #3).
- The server component calls `contracts.service.list` and `getDashboardSummary` for the first render.
- The sort column is whitelisted against an enum, and secondary sort is always `id` for stable paging.

**State management**
- `useContracts({ sort, dir, page })` with `placeholderData: keepPreviousData`.
- Sort state is kept in URL search params (`?sort=file_name&dir=asc`) so it survives a refresh.

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `DashboardHeader` | `firstName?` | "Your contracts" (H5) + `ReviewContractButton` (primary, prominent) |
| `SummaryCards` | `summary` | 3 `StatCard`s: Total reviewed / NDAs / MSAs |
| `StatCard` | `label`, `value` | Value as H5, label 12/18 `text-secondary` |
| `UsageMeter` | `usage` | "3 of 5 trial analyses used · 9 days left"; bar turns warning at 80% and danger at 100% |
| `ContractsTable` | `items`, `sort`, `dir`, `onSort`, `page`, `total` | Columns: Name, Type, Uploaded, Status, Low-confidence; sortable headers with `aria-sort`; whole row clickable (Enter key as well); row menu (Open, Delete); pagination |
| `StatusBadge` | `status` | ready → "Ready to process" (Blue); processing → "Processing" (Blue + spinner); completed → "Reviewed" (Green); error → "Failed" (Red) |
| `EmptyState` | — | Illustration-free: H5 "No contracts reviewed yet", body copy, CTA |

**Design**
- Page wrapper: `bg-surface`, padding 96/112 px desktop, 40 px section gap.
- Table: `bg-primary`, 8 px radius, Grey 100 row dividers, 48 px row height, hover Grey 50.
- Header cells 12/18 `text-secondary`.

**Edge cases**
- 0 contracts → empty state; summary cards still show 0.
- `uploading` rows are hidden from the list (abandoned uploads).
- A `processing` row older than 3 minutes is shown as Failed.
- Deleting the last item on a page → go to the previous page.
- Very long file names are truncated with a full-name tooltip.

---

## F10 — Feedback

**User flow:** §4.10.

**DB schema:** `user_feedback` (§7.3).

**DB tasks:** create the table, unique `(contract_id, user_id)`, RLS (SELECT/INSERT/UPDATE own), `set_updated_at` trigger.

**API routes**
- `POST /api/contracts/{id}/feedback` (§9.3 #13).
- Upsert via the user client: `.upsert({...}, { onConflict: 'contract_id,user_id' })`.

**State management:** `useSubmitFeedback(contractId)`; the initial value comes from `useContract().feedback`.

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `FeedbackWidget` | `initial`, `onSubmit` | "Were these results accurate?" with 👍 and 👎 toggle buttons (`aria-pressed`). Selecting one reveals an optional comment textarea (≤ 1,000 chars) and Submit. Then shows "Thanks for your feedback" with a "Change" link |

**Design**
- Sits at the bottom of the key-terms panel, separated by a Grey 100 divider; 16 px padding.
- Selected thumb: `brand` icon on a Blue 50 background.

**Edge cases**
- Feedback isn't available until status = `completed`.
- Submitting a rating without a comment is allowed.
- Changing the rating updates the same row.
- A comment over 1,000 chars is blocked client-side, and the server returns 400.

---

## F11 — Usage Quota & Rate Limiting

**User flow:** §4.12. The dashboard always shows the usage meter. When the trial is exhausted or expired, the upload page shows `QuotaExceededCard`, and the API returns 402.

**DB schema:** `usage_events`, `rate_limits`, `profiles.plan` / `trial_ends_at` (§7.3).

**DB tasks**
- Create `rate_limits` (RLS on, no policies).
- Create `check_rate_limit()` (SECURITY DEFINER; EXECUTE granted to service_role only):
  ```sql
  INSERT INTO rate_limits(key, window_start, count)
  VALUES (p_key, to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds), 1)
  ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
  RETURNING count <= p_limit
  ```
- Create the `usage_events_quota_idx` partial index.

**API routes**
- `GET /api/usage` (§9.3 #14).
- Guards used in init, process and chat:
  - `assertQuota(user)`: trial → count successful `extraction` events since `profiles.created_at`, must be < 5 and `now() < trial_ends_at`; paid plans → count since the start of the current calendar month (UTC) against `PLANS[plan].monthlyAnalyses` (null = unlimited).
  - `assertRateLimit(name, userId)`: reads `RATE_LIMITS[name]` from `lib/constants/rate-limits.ts`; on failure throws 429 with `Retry-After = seconds left in the window`.

**State management:** `useUsage()` (TanStack, invalidated after a successful process).

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `UsageMeter` | (F09) | — |
| `QuotaExceededCard` | `reason` | H5 "You've used your free trial"; body text by reason; CTA "Join the waitlist for paid plans" (`mailto:` `NEXT_PUBLIC_SUPPORT_EMAIL`); secondary "Back to dashboard" |

**Design:** the card uses `bg-primary` with a Yellow 50 header strip and Yellow 800 text for the reason.

**Edge cases**
- Concurrent processes for the 5th and 6th analysis → both pass `assertQuota`. Accepted at MVP scale (worst case 6 analyses). Phase 3 can add a stricter `SELECT … FOR UPDATE` counter.
- Failed analyses don't count.
- Deleting contracts doesn't restore quota (`contract_id` SET NULL).
- `rate_limits` growth is pruned daily.
- A `rate_limits` RPC failure → **fail open** for chat and edits, **fail closed** for process (protects cost), with an error log.

---

## F12 — Data Retention & Deletion

**User flow:** §4.11 (user deletion). Retention runs daily with no UI; afterwards the viewer shows the text fallback with the note "Original PDF removed after 90 days of inactivity".

**DB schema:** FK cascades (§7.3), `contracts.pdf_deleted_at`, `contracts_retention_idx`.

**DB tasks**
- Confirm every child FK uses `ON DELETE CASCADE` and `usage_events.contract_id` uses `ON DELETE SET NULL`.
- Account deletion: `auth.users` deletion cascades everything (GDPR). Triggered manually via the Supabase dashboard in the MVP; documented in the security plan.

**API routes**
- `DELETE /api/contracts/{id}` (§9.3 #5).
- `GET /api/cron/retention` (§9.3 #15).
- `vercel.json`: `{ "crons": [{ "path": "/api/cron/retention", "schedule": "0 3 * * *" }] }`.
- `retention.service.run()` processes in batches of 100. Storage removal uses `storage.from('contracts').remove(paths[])`. Each job is wrapped in a try/catch so one failure doesn't block the others. A summary is logged.

**State management:** `useDeleteContract()` → on success, invalidates `['contracts']`, removes `['contract', id]` and navigates to `/dashboard`.

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `DeleteContractDialog` | `contractName`, `onConfirm`, `open`, `onOpenChange` | Radix AlertDialog; destructive confirm button "Delete permanently"; spinner while pending; focus starts on Cancel |

**Design:** the destructive button uses Red 500 bg with white text; the dialog has 12 px radius and 24 px padding.

**Edge cases**
- Deleting during `processing` → 409 (unless stale).
- Storage removal fails → rows are still deleted, and the orphaned object is logged for manual cleanup.
- Retention deletes a PDF the user is viewing → the next URL fetch returns 410 → text mode.
- Retention must use the service role with the `CRON_SECRET` header; requests without it get 401.

---

## F13 — Landing Page, Disclaimers & Onboarding

**User flow**
- `/` (static): hero ("Understand any NDA or MSA in minutes, not hours"), 3 value props (page-level references, confidence scores, chat grounded in your document), "How it works" (Upload → Review terms → Ask questions), a demo media placeholder, and CTAs "Get Started Free" → `/signup` and "Sign In" → `/login`.
- First visit to the results page → a 3-step tooltip tour (confidence badge, page link, chat tab). "Got it" sets `profiles.onboarding_completed_at`.

**DB schema:** `profiles.onboarding_completed_at`.

**DB tasks:** column grant (F01).

**API routes**
- Server action `completeOnboarding()` → update the own profile.
- No new endpoints.

**State management:** `onboardingCompleted` is passed from the server component; local step index state.

**Component spec**

| Component | Props | Behavior |
|---|---|---|
| `LandingHero` | — | H1 + subcopy + 2 CTAs |
| `ValueProps` / `HowItWorks` | — | Static grids (flex-wrap, 24 px gap) |
| `MarketingFooter` / `AppFooter` | — | "Powered by OpenAI GPT-4o" · "Not legal advice" · © ContractIQ |
| `DisclaimerBanner` | (F05) | — |
| `OnboardingTooltips` | `steps`, `onDone` | Radix Popover anchored to `data-tour` targets; keyboard navigable; Skip |

**Design**
- Landing page uses the page wrapper (96/112 px), `bg-primary` sections alternating with `bg-surface`.
- Inter Display throughout; flat (no gradients or shadows).
- CTAs use `brand`; a secondary outline button for Sign In.

**Edge cases**
- A signed-in user visiting `/` → "Go to dashboard" CTA instead of "Get Started".
- The tour targets aren't present (mobile tab hidden) → skip that step.
- `prefers-reduced-motion` → no tooltip animation.

---

## Cross-cutting checklist (applies to every feature)

- [ ] Every Route Handler is wrapped in `withHandler` (auth, Zod, rate limit, error envelope, requestId).
- [ ] No `contract_text`, chat content, or `OPENAI_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in logs or client bundles (`import 'server-only'` in `lib/supabase/admin.ts`, `lib/ai/*` and `lib/services/*`).
- [ ] All UI uses semantic design tokens only; spacing is on the 4 px grid; Inter Display only.
- [ ] Every interactive element is keyboard reachable with a visible focus ring; status is never conveyed by color alone.
- [ ] Each feature ships with unit tests and integration tests per §13, plus RLS cross-user tests for any new table.
