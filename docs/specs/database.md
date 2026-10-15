# Spec — Database, RLS & Storage

**Source:** engineering-doc.md §7 · **Runnable artifact:** `docs/specs/supabase-schema.sql` (copied verbatim to `supabase/migrations/20261011000000_initial_schema.sql`).

---

## 1. Apply the schema

1. Create a Supabase project (region closest to Vercel deployment; Postgres 15+).
2. Dashboard → SQL Editor → paste `docs/specs/supabase-schema.sql` → Run. The script is idempotent (safe to re-run).
3. Auth settings (Dashboard → Authentication):
   - Providers → Email: **enabled**, **Confirm email: on**, minimum password length **8**.
   - URL Configuration → Site URL = `NEXT_PUBLIC_APP_URL`; Redirect URLs add `${NEXT_PUBLIC_APP_URL}/auth/callback` and `http://localhost:3000/auth/callback`.
   - Email templates → "Confirm signup": keep default link (`{{ .ConfirmationURL }}`), which uses PKCE `?code=` with `@supabase/ssr`.
4. Generate types: `SUPABASE_PROJECT_ID=<ref> npm run db:types` → `src/types/database.types.ts`.
5. Local dev (optional): `supabase init && supabase start`, copy the SQL into `supabase/migrations/`, `supabase db reset`.

Validated: the schema was executed twice against a clean Postgres with Supabase `auth`/`storage` stubs and the RLS behaviour in §4 was verified (cross-user isolation, column grants, server-only functions, custom-term limit, append-only chat, Storage folder isolation, anon lockout, cascades).

## 2. Objects

| Object | Type | Purpose |
|---|---|---|
| `contract_type`, `contract_status`, `chat_role`, `usage_event_type` | enums | Domain values |
| `profiles` | table | Plan + trial window per user; auto-created by `handle_new_user` trigger |
| `contracts` | table | Uploaded contract, extracted text (`[PAGE N]` markers), lifecycle |
| `custom_key_terms` | table | User-requested extra terms (≤ 5) |
| `key_terms` | table | AI results + user edits (`original_value` immutable) |
| `chat_sessions` / `chat_messages` | tables | One thread per contract; append-only messages |
| `user_feedback` | table | One rating per user per contract |
| `usage_events` | table | Quota ledger + cost telemetry (survives contract deletion) |
| `rate_limits` | table | Fixed-window counters (service role only) |
| `term_corrections` | view | Edited terms → correction-rate metric |
| `contract_list_items` | view | Dashboard rows incl. `low_confidence_count`, excludes `uploading` |
| `set_updated_at()` | trigger fn | `updated_at` maintenance |
| `handle_new_user()` | trigger fn | Insert profile on sign-up |
| `enforce_custom_term_limit()` | trigger fn | Max 5 custom terms (locks parent contract row) |
| `protect_key_term_columns()` | trigger fn | Freezes `original_value`, `term_key`, `term_name`, `contract_id`, `user_id`, `is_custom` on update |
| `replace_key_terms(contract, user, jsonb)` | RPC (service role) | Atomic delete + insert of results; returns inserted count |
| `check_rate_limit(key, limit, window_s)` | RPC (service role) | Increment + compare; returns boolean |
| bucket `contracts` | storage | Private, 10 MB, `application/pdf` only |

## 3. Status lifecycle (`contracts.status`)

```
uploading ──extract ok──▶ ready ──process claim──▶ processing ──ok──▶ completed
    │                       ▲                          │
    │ extract rejected      └────── retry ◀── error ◀──┘ (AI failure / stale > 3 min)
    ▼
 (row deleted)
```

Transitions are performed only by the server (admin client). The DB constraint `contracts_text_after_upload` guarantees `contract_text` exists for every status except `uploading`.

## 4. RLS & privilege matrix (`authenticated` role)

| Table | SELECT | INSERT | UPDATE (columns) | DELETE |
|---|---|---|---|---|
| profiles | own | — (trigger) | own: `full_name`, `onboarding_completed_at` | — (cascade) |
| contracts | own | own | own: `file_name`, `last_accessed_at` | own |
| custom_key_terms | own | own + owns contract | — | own |
| key_terms | own | — (RPC) | own: `value`, `is_edited`, `edited_at` | — (cascade) |
| chat_sessions | own | own + owns contract | — | — (cascade) |
| chat_messages | own | own, `role='user'`, owns session | — | — |
| user_feedback | own | own + owns contract | own | — (cascade) |
| usage_events | own | — | — | — |
| rate_limits | — | — | — | — |
| storage.objects (`contracts`) | own folder | own folder | — | own folder |

Table privileges are granted explicitly (not relying on Supabase's "automatically expose new tables" setting), then narrowed with the column-level grants above. `anon` has no privileges on any `public` table or view. `service_role` bypasses RLS and is the only role allowed to execute `replace_key_terms` and `check_rate_limit`.

## 5. JSON payload for `replace_key_terms`

```json
[
  {
    "term_name": "Governing Law",
    "term_key": "governing_law",
    "value": "Delaware, USA",
    "page_number": 7,
    "confidence_score": 94,
    "source_sentence": "This Agreement shall be governed by the laws of the State of Delaware.",
    "is_custom": false,
    "display_order": 6,
    "validation_flags": []
  }
]
```
`original_value` is set to `value` by the function. Unknown keys are ignored.

Call: `admin.rpc('replace_key_terms', { p_contract_id, p_user_id, p_terms })`.

## 6. Storage conventions

- Key: `{user_id}/{contract_id}/source.pdf` (fixed filename; display name lives in `contracts.file_name`).
- Signed **upload** URL: `admin.storage.from('contracts').createSignedUploadUrl(path)` → `{ token, path }` (valid 2 h, Supabase default).
- Signed **view** URL: `admin.storage.from('contracts').createSignedUrl(path, 3600)`.
- Download for extraction: `admin.storage.from('contracts').download(path)`.
- Delete: `admin.storage.from('contracts').remove([path])`.
- Admin client is used for Storage so that behaviour does not depend on Storage RLS; ownership is always verified first via the user-scoped `contracts` read.

## 7. Seed data — `scripts/seed.ts` (local only)

Run with `tsx scripts/seed.ts` against local Supabase (refuses to run unless `NEXT_PUBLIC_SUPABASE_URL` starts with `http://127.0.0.1` or `http://localhost`). Uses the Admin API (`admin.auth.admin.createUser({ email, password, email_confirm: true })`) — never raw inserts into `auth.users`. Creates `alice@test.local` and `bob@test.local` (password `Password123!`), uploads `tests/fixtures/pdfs/nda-sample.pdf` for Alice and inserts it as a `completed` NDA with 10 key terms (confidences 95/72/31/0 mix) via `replace_key_terms`, a `ready` MSA for Bob, and a chat session with 2 messages for Alice. `supabase/seed.sql` stays empty.

## 8. Migrations policy

Schema changes after v1: add a new timestamped file in `supabase/migrations/`, regenerate `database.types.ts`, update this spec and `supabase-schema.sql` (the latter remains the full paste-and-run snapshot).
