# ContractIQ — Security Plan

| Field | Value |
|---|---|
| Stage | 7 — Security Fixes (`/security-foundation`) |
| Date | 2026-10-12 |
| Scope | `contractiq/` (Next.js 15.5.27, React 19, Supabase, OpenAI GPT-4o) |
| Inputs | `docs/engineering/engineering-doc.md`, `docs/specs/*`, full codebase scan, `npm audit` |
| Status | Implemented locally — **`contractiq/supabase/rls-policies.sql` must be run in Supabase** before rate-limited endpoints work |

---

## 1. Decisions taken for this stage

The security skill's generic defaults conflicted with the PRD in places. Decisions (confirmed with the product owner):

| Topic | Skill default | Decision |
|---|---|---|
| Page / message / history limits | 200 pages, 5,000 chars, 100 messages | **Keep PRD limits**: 20 pages, ~15k tokens, 2,000 chars, 10/20 turns. `MAX_CHAT_HISTORY` (default 100) is an extra hard cap |
| Rate limiting | Sliding window, `rate_limit_events` | **Adopted** (replaces the fixed-window `rate_limits` table) |
| Auth endpoints | `/api/auth/login`, `/api/auth/logout` | **Adopted**; sign-in form and sign-out button now use them |
| Chat availability | Completed contracts only | **Adopted** |
| Allowed uploads | `.pdf`, `.docx` | **PDF only** — `.docx` is out of PRD scope and has no extraction path |
| Framework | — | **Upgraded Next.js 14.2.35 → 15.5.27 and React 18 → 19** to close 23 Next.js advisories (see §9) |

---

## 2. Security surfaces and controls

| # | Surface | Control | Where |
|---|---|---|---|
| 1 | Authentication | Supabase Auth email+password, email verification, server-side sign-in/out, password reset flow, refresh via middleware, `getUser()` (JWT validated) on every server request | `middleware.ts`, `lib/security/authGuard.ts`, `app/api/auth/*`, `app/(auth)/actions.ts`, `app/auth/callback` |
| 2 | Protected routes | Middleware redirects signed-out users from `/dashboard`, `/contracts`, `/chat`, `/settings`, `/profile`, `/reset-password` to `/login?next=…`; signed-in users skip `/login`, `/signup`, `/forgot-password`; `(app)/layout.tsx` re-checks server-side | `middleware.ts`, `app/(app)/layout.tsx` |
| 3 | API validation | Every route handler goes through `withHandler`: auth → rate limit → Zod params/query/body; invalid input returns **422 `VALIDATION_ERROR`** before any business logic or DB call | `lib/api/handler.ts`, `lib/security/inputValidator.ts`, `lib/validation/*` |
| 4 | Rate limiting | Supabase sliding window (`rate_limit_events` + atomic `rate_limit_hit` RPC, service role only); 429 + `Retry-After` | `lib/security/rateLimiter.ts`, `supabase/rls-policies.sql` |
| 5 | Prompt injection | `sanitizeForLLM()` on every chat message and custom term name → **400 `PROMPT_INJECTION`**, model not called; contract text fenced and delimiter tags neutralised; system prompts treat contract/user text as data | `lib/security/promptInjectionGuard.ts`, `lib/services/chat.service.ts`, `custom-terms.service.ts`, `extraction.service.ts` |
| 6 | Token & usage limits | Central limits + `MAX_CHAT_HISTORY` cap; per-type history windows (memory layer); 15k-token contract cap; 20k-token history cap; trial quota | `lib/security/tokenLimiter.ts`, `lib/chat/memory.ts`, `usage.service.ts` |
| 7 | Chat security | `verifyContractOwnership()` + `verifySessionOwnership()` (explicit `user_id === caller` on top of RLS) before every chat request; chat only when `status = 'completed'` (409 `CHAT_NOT_READY`) | `lib/security/chatSecurity.ts` |
| 8 | File upload | Extension blocklist → allowlist (PDF) → MIME → size, client and server; `%PDF-` magic bytes server-side; private bucket; 1-hour signed URLs only | `lib/security/inputValidator.ts`, `contracts.service.ts`, `pdf-dropzone.tsx` |
| 9 | Environment variables | `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` server-only (no `NEXT_PUBLIC_`), validated lazily by Zod; service role used only in `createAdminClient()`; ESLint blocks server modules from client code | `lib/env.ts`, `lib/supabase/admin.ts`, `.eslintrc.json` |
| 10 | Data isolation | RLS on every table; column-level grants (users can't change `plan`, `status`, AI originals, usage ledger); Storage policies per user folder | `database.sql`, `supabase/rls-policies.sql` |
| 11 | Browser hardening | CSP, `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP, `X-Powered-By` removed, `Cache-Control: no-store` on `/api/*` | `next.config.mjs` |
| 12 | CSRF | Server Actions: Next.js origin check. Auth routes: explicit `Origin` check (403 `FORBIDDEN_ORIGIN`). JSON APIs: SameSite=Lax cookies + non-simple JSON requests | `lib/security/authGuard.ts` |
| 13 | Audit logging | Structured `audit=true` log lines for sign-in success/failure, sign-out, sign-up, password reset/change, contract deletion, rejected origins, blocked injections, rate-limit blocks; secrets/emails/contract text redacted | `lib/security/auditLog.ts`, `lib/utils/logger.ts` |
| 14 | Dependencies | `npm audit --omit=dev`: **0 vulnerabilities** | `package.json` (`overrides`) |

### 2.1 Rate limits

| Action | Limit | Subject | Fail mode |
|---|---|---|---|
| `auth` (sign-in, sign-up, resend, password reset, password change) | 10 / minute | hashed IP **and** hashed email | closed |
| `chat` | 30 / minute | user | open |
| `chat_daily` | 300 / day | user | open |
| `process` (AI extraction) | 5 / hour | user | closed |
| `upload` | 20 / day | user | closed |
| `key_term_edit` | 120 / minute | user | open |
| `feedback` | 30 / hour | user | open |

"Fail closed" = if the limiter store is unavailable the request is refused (auth and cost-bearing actions); "open" = allowed and logged. Subjects never contain raw IPs or emails (SHA-256, truncated). Events older than 24 h are pruned by the daily cron.

### 2.2 Prompt-injection patterns blocked

Instruction override (`ignore/disregard/override … instructions/rules`), prompt disclosure (`reveal/print … system prompt / your instructions`), secret disclosure (`show/expose … env variables / API keys / service role / credentials`), data exfiltration (`dump … database / all users`), role hijack (`you are now a…`, `act as an unrestricted/the system…`, `pretend you are`), jailbreak keywords (`jailbreak`, `DAN mode`, `developer mode`, `god mode`), fake turns (`system:`, `<system>`, `</contract>`). Text is NFKC-normalised and stripped of zero-width/control characters before matching. Patterns are specific enough that normal contract questions ("Does the vendor act as a data processor?", "Can they reveal confidential information?") pass — covered by 24 unit tests.

---

## 3. Issues found and fixed

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | **Critical** | Next.js 14.2.35 affected by 23 advisories (RCE in Image Optimizer, Server Actions/RSC DoS, SSRF, cache poisoning); 14.x no longer receives fixes | Upgraded to **Next.js 15.5.27 + React 19** (async `cookies()`/`params`, `useActionState`, `serverExternalPackages`); image optimizer also disabled |
| 2 | High | PostCSS bundled by Next (8.4.31): file disclosure / XSS advisories | `overrides.next.postcss = ^8.5.29` |
| 3 | High | No rate limiting on sign-in / sign-up / resend → credential stuffing and email bombing | `auth` limit 10/min per IP and per email on all auth entry points |
| 4 | High | Custom term names are inserted into the extraction prompt but were only character-filtered ("ignore previous instructions" passed) | `sanitizeForLLM()` on add; extraction skips any stored term that fails detection |
| 5 | High | Contract text could close the `<contract>` fence (`</contract>`) and inject instructions | `neutralizeContractText()` before every prompt (extraction + chat) |
| 6 | High | Chat messages reached the model with no injection screening | `sanitizeForLLM()` before save and before the model call → 400 `PROMPT_INJECTION`; UI returns the text for rephrasing |
| 7 | Medium | No Content-Security-Policy | CSP added (Supabase-only `connect-src`, `frame-ancestors 'none'`, `object-src 'none'`, …), verified with no violations |
| 8 | Medium | `safeNext` could be bypassed with control characters (`/\t/evil.com`) | URL-parse with a sentinel origin; reject backslashes/control chars; callback `next` uses it |
| 9 | Medium | Chat allowed on contracts still processing / failed | Completed-only (`CHAT_NOT_READY`), UI explains |
| 10 | Medium | Chat ownership relied solely on RLS | Explicit `verifyContractOwnership` / `verifySessionOwnership` |
| 11 | Medium | Upload checks were extension-or-MIME only; double extensions (`nda.pdf.exe`, `x.js.pdf`) not blocked | `validateFileUpload()` blocklist (any extension segment) → allowlist → MIME → size, client + server (`mimeType` now required on init) |
| 12 | Medium | No password-reset flow (account recovery) | `/forgot-password` (no account enumeration, rate-limited) → recovery link → `/reset-password` (signs out other sessions) |
| 13 | Low | Fixed-window limiter allowed 2× bursts at window edges | Sliding window with advisory lock (atomic) |
| 14 | Low | API responses had no cache directive | `Cache-Control: no-store` on `/api/*` |
| 15 | Low | `X-Powered-By` header disclosed framework | `poweredByHeader: false` |
| 16 | Low | Logger redaction missed `token`, `cookie`, `apikey`, `secret`, `email` keys | Added to the redaction set |
| 17 | Low | Validation errors returned 400 (skill requires 422) | `VALIDATION_ERROR` → 422 |
| 18 | Info | `CRON_SECRET` was empty in `.env.local` (cron endpoint unusable) | Generated a 64-char secret (Stage 4) |

---

## 4. Files

### Created
| File | Purpose |
|---|---|
| `contractiq/src/lib/security/authGuard.ts` | `requireAuth()`, `assertSameOrigin()` |
| `contractiq/src/lib/security/rateLimiter.ts` | Sliding-window limiter, `RATE_LIMITS`, IP/email subject hashing |
| `contractiq/src/lib/security/promptInjectionGuard.ts` | `sanitizeForLLM()`, `detectPromptInjection()`, `neutralizeContractText()` |
| `contractiq/src/lib/security/tokenLimiter.ts` | Limits + validators, `MAX_CHAT_HISTORY` cap |
| `contractiq/src/lib/security/chatSecurity.ts` | `verifyContractOwnership()`, `verifySessionOwnership()` |
| `contractiq/src/lib/security/inputValidator.ts` | `validateFileUpload()` + re-exports of all Zod schemas (`lib/validation/*`) |
| `contractiq/src/lib/security/auditLog.ts` | `audit()` structured security events |
| `contractiq/src/app/api/auth/login/route.ts` | Server-side sign-in (origin check, rate limits, audit) |
| `contractiq/src/app/api/auth/logout/route.ts` | Server-side sign-out |
| `contractiq/src/app/(auth)/forgot-password/page.tsx`, `reset-password/page.tsx` | Password reset flow |
| `contractiq/src/components/auth/forgot-password-form.tsx`, `reset-password-form.tsx` | Forms |
| `contractiq/supabase/rls-policies.sql` | Rate-limit table/RPC + RLS re-assertion (paste-and-run) |
| `contractiq/tests/unit/security.test.ts` | 45 tests (injection, uploads, limits, redirects, subjects) |
| `docs/security/security-plan.md` | This document |

### Modified
`package.json` (Next 15.5.27, React 19, overrides, dev-only `tailwindcss-animate`, removed unused `react-hook-form`) · `next.config.mjs` (CSP/headers, image optimizer off) · `middleware.ts` · `src/lib/api/handler.ts` · `src/lib/api/errors.ts` (422, `PROMPT_INJECTION`, `CHAT_NOT_READY`, `INVALID_CREDENTIALS`, `EMAIL_NOT_CONFIRMED`, `FORBIDDEN_ORIGIN`) · `src/lib/supabase/server.ts` (async) · `src/lib/env.ts` (`MAX_CHAT_HISTORY`) · `src/lib/utils/logger.ts` · `src/lib/validation/auth.ts` · `src/lib/validation/contracts.ts` (`mimeType`) · `src/lib/services/{chat,contracts,custom-terms,extraction,retention}.service.ts` · `src/app/(auth)/actions.ts` · `src/app/auth/callback/route.ts` · `src/components/auth/login-form.tsx` · `src/components/layout/user-menu.tsx` · `src/components/contracts/pdf-dropzone.tsx` · `src/components/chat/chat-tab.tsx` · `src/stores/upload-store.ts` · all pages using `params`/`searchParams` (async) · `database.sql` + `docs/specs/supabase-schema.sql` + migration copy (new limiter) · `src/types/database.types.ts` · `.env.example`

### Removed
`src/lib/services/rate-limit.service.ts`, `src/lib/constants/rate-limits.ts` (replaced by `lib/security/rateLimiter.ts`); Supabase objects `rate_limits` and `check_rate_limit()` (dropped by the migration).

---

## 5. Required actions (owner)

1. **Run `contractiq/supabase/rls-policies.sql`** in Supabase → SQL Editor. Until then sign-in, sign-up, upload and processing return errors (their limiters fail closed by design).
2. **Supabase → Authentication**:
   - Providers → Email: *Confirm email* **on**; minimum password length **8**.
   - URL Configuration → Redirect URLs: add `http://localhost:3000/**` (and your production `https://<domain>/**`) so verification and password-reset links (`/auth/callback?next=…`) are accepted.
   - Sessions: *Refresh token rotation* **on** with a reuse interval of 10 s (default); consider an inactivity timeout of 7 days.
   - Rate limits (Auth → Rate Limits): keep the email-sending limit low (default) to complement app-level limits.
3. **Rotate** `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (both appeared in a chat transcript during setup) and update `.env.local` / Vercel.
4. Optional: add `MAX_CHAT_HISTORY=100` to `.env.local` (default is 100 when unset).
5. Before production: set `AI_MOCK_MODE` empty (the app refuses to start with it enabled on Vercel production).

---

## 6. Verification performed

| Check | Result |
|---|---|
| `npm run typecheck`, `npm run lint` | Pass |
| Unit tests | 93 / 93 pass (45 security, 19 memory layer) |
| Production build (Next 15.5.27) | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |
| SQL: migration over the previous schema, twice | Pass; old limiter dropped |
| SQL: fresh `database.sql`, twice + RLS behaviour suite | Pass |
| Sliding window (limit 3/60 s) | `0,0,0,60,60`; other actions unaffected; frees after window; `authenticated` cannot read events or call the RPC |
| Security headers on `/` | CSP, XFO, nosniff, Referrer, Permissions, HSTS, COOP present; no `X-Powered-By` |
| `/api/auth/login` invalid body / foreign origin | 422 `VALIDATION_ERROR` / 403 `FORBIDDEN_ORIGIN` |
| `/api/auth/logout` without origin | 403 |
| `/_next/image` | 404 (disabled) |
| Protected routes signed out | All 6 redirect to `/login?next=…` |
| Callback `next=//evil.com` | Not followed |
| Browser console on `/`, `/login`, `/forgot-password` | No CSP violations; hydration and fonts OK |

Not verified here (requires a real signed-in account against the live Supabase project, which was deliberately not created by the assistant): end-to-end sign-in through the new route, password-reset email round trip, live rate-limit 429s, chat injection block in the UI. These are in the Stage 5 test plan.

---

## 7. Accepted risks and outstanding items

| Item | Risk | Plan |
|---|---|---|
| CSP allows `'unsafe-inline'` scripts | Weakens XSS defence-in-depth (React escaping remains the primary control; no `dangerouslySetInnerHTML`; pdf.js text layer output is escaped) | Move to nonce-based CSP via middleware when adopting Next's nonce support |
| Supabase auth cookies are not `HttpOnly` (required by `@supabase/ssr` browser client) | Token theft if XSS occurs | CSP + no raw HTML rendering; revisit if browser client is removed |
| Storage: signed-in users can upload directly into their own folder outside the init flow | Storage abuse limited to own folder, 10 MB, `application/pdf`, no processing without init/extract | Monitor bucket size; cron removes orphaned `uploading` rows |
| Prompt-injection detection is pattern-based | Novel phrasings may pass | Defence in depth: data-only system prompts, fenced contract, grounded answers, no tools/actions available to the model; review `security.prompt_injection_blocked` logs monthly |
| Concurrent trial analyses could exceed the 5-analysis quota by one | Minor cost | Accepted for MVP (spec) |
| Dev-only advisories (`tar` in Supabase CLI, `esbuild` in Vite dev server, `@vitest/mocker`) | Development machines only; not shipped | Upgrade Vitest/Supabase CLI in Stage 5 |
| Account deletion is a manual operator procedure | GDPR request handling relies on process | Documented in `docs/specs/retention-and-deletion.md`; self-serve deletion in Phase 2 |
| No automated alerting on audit events | Detection delay | Add a Vercel log drain + alerts on `auth.login_failed` spikes and `cost.alert` before launch |
