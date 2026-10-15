# Spec — API Conventions, Errors & Server Plumbing

**Source:** engineering-doc.md §6.2, §9 · **Applies to:** every Route Handler, Server Action and service.

---

> **Stage 7 security update:** `VALIDATION_ERROR` is now **422**; new codes `PROMPT_INJECTION` (400), `INVALID_CREDENTIALS` (401), `EMAIL_NOT_CONFIRMED` (403), `FORBIDDEN_ORIGIN` (403), `CHAT_NOT_READY` (409). Auth guard, rate limiting and input validation live in `src/lib/security/`. Authoritative: `docs/security/security-plan.md`.


## 1. Route map

| # | File | Methods | Spec |
|---|---|---|---|
| 1 | `src/app/api/contracts/init/route.ts` | POST | contract-upload-and-extraction.md |
| 2 | `src/app/api/contracts/[id]/extract/route.ts` | POST | contract-upload-and-extraction.md |
| 3 | `src/app/api/contracts/route.ts` | GET | dashboard.md |
| 4–5 | `src/app/api/contracts/[id]/route.ts` | GET, DELETE | results-page-and-key-terms.md, retention-and-deletion.md |
| 6 | `src/app/api/contracts/[id]/custom-terms/route.ts` | POST | custom-key-terms.md |
| 7 | `src/app/api/contracts/[id]/custom-terms/[termId]/route.ts` | DELETE | custom-key-terms.md |
| 8 | `src/app/api/contracts/[id]/process/route.ts` | POST | ai-extraction-pipeline.md |
| 9 | `src/app/api/contracts/[id]/pdf-url/route.ts` | GET | contract-viewer.md |
| 10 | `src/app/api/key-terms/[id]/route.ts` | PATCH | key-term-editing.md |
| 11–12 | `src/app/api/contracts/[id]/chat/route.ts` | GET, POST (SSE) | contract-chat.md |
| 13 | `src/app/api/contracts/[id]/feedback/route.ts` | POST | feedback.md |
| 14 | `src/app/api/usage/route.ts` | GET | usage-quota-and-rate-limits.md |
| 15 | `src/app/api/cron/retention/route.ts` | GET | retention-and-deletion.md |
| — | `src/app/auth/callback/route.ts` | GET | auth.md |

Every route file starts with `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';`.

## 2. Supabase clients — `src/lib/supabase/`

| File | Export | Key | Use |
|---|---|---|---|
| `server.ts` | `createClient()` | anon + user cookies | Server Components, Route Handlers, Server Actions. **RLS applies.** Default choice |
| `client.ts` | `createBrowserClient()` | anon | Browser only: `storage.uploadToSignedUrl`, auth state listener |
| `admin.ts` | `createAdminClient()` | service_role | **Server only** (`import 'server-only'`). Only after ownership is verified with `server.ts`. Used for: contract status/text updates, `replace_key_terms`, assistant chat messages, `usage_events`, `check_rate_limit`, storage signed upload URLs/downloads, cron |
| `middleware.ts` | `updateSession(req)` | anon | Called by root `middleware.ts` |

`server.ts` follows the `@supabase/ssr` cookie pattern (`cookies().getAll()` / `setAll` in try/catch for Server Components). Always authenticate with `supabase.auth.getUser()` (validates the JWT with Supabase), never `getSession()` on the server.

## 3. Handler wrapper — `src/lib/api/handler.ts`

```ts
type HandlerCtx<P, B, Q> = {
  req: NextRequest;
  params: P;              // Zod-parsed route params
  body: B;                // Zod-parsed JSON body (undefined for GET/DELETE)
  query: Q;               // Zod-parsed search params
  user: { id: string; email: string };
  supabase: SupabaseClient<Database>;  // user-scoped (RLS)
  requestId: string;
};

export function withHandler<P, B, Q>(
  opts: {
    auth?: boolean;                                 // default true
    params?: z.ZodType<P>;
    body?: z.ZodType<B>;
    query?: z.ZodType<Q>;
    rateLimit?: RateLimitName;                      // key from RATE_LIMITS
  },
  fn: (ctx: HandlerCtx<P, B, Q>) => Promise<Response | unknown>,
): (req: NextRequest, route: { params: Record<string, string> }) => Promise<Response>;
```

Order: `requestId = crypto.randomUUID()` → auth (`getUser`; none → `UNAUTHENTICATED`) → `assertRateLimit(opts.rateLimit, user.id)` → parse params → parse query → parse body (invalid JSON → `VALIDATION_ERROR`) → `fn` → if `fn` returns a `Response`, pass through (SSE, 204); else `NextResponse.json(result, { status: 200 })` → every response gets header `x-request-id`.

Errors: `AppError` → `toErrorResponse`; `ZodError` → 400 `VALIDATION_ERROR` with `fieldErrors` (`error.flatten().fieldErrors`); anything else → log `{ level: 'error', requestId, route, err.message, err.stack }` and return 500 `INTERNAL`.

Common param schemas (`src/lib/validation/common.ts`): `idParamSchema = z.object({ id: z.string().uuid() })`, `contractTermParamSchema = z.object({ id: z.string().uuid(), termId: z.string().uuid() })`.

## 4. Errors — `src/lib/api/errors.ts`

```ts
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public meta?: Record<string, unknown>,   // e.g. { retryAfterSeconds: 42 } or { fieldErrors }
    public cause?: unknown,
  ) { super(code); }
  get status() { return ERROR_CATALOG[this.code].status; }
  get userMessage() { return ERROR_CATALOG[this.code].message; }
}
```

Response envelope (all non-2xx JSON responses):

```json
{ "error": { "code": "QUOTA_EXCEEDED", "message": "You've used all analyses in your free trial.", "requestId": "9b6c…", "fieldErrors": { "termName": ["Too short"] } } }
```

`RATE_LIMITED` also sets header `Retry-After: <seconds>`.

### Catalog (`ERROR_CATALOG`)

| Code | Status | Message |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Some fields are invalid. |
| `UNAUTHENTICATED` | 401 | Please sign in to continue. |
| `UNAUTHORIZED_CRON` | 401 | Unauthorized. |
| `QUOTA_EXCEEDED` | 402 | You've used all analyses in your free trial. |
| `NOT_FOUND` | 404 | We couldn't find that contract. |
| `INVALID_STATE` | 409 | This action isn't available right now. |
| `ALREADY_PROCESSING` | 409 | This contract is already being analysed. |
| `CUSTOM_TERM_DUPLICATE` | 409 | That term is already in the list. |
| `PDF_UNAVAILABLE` | 410 | PDF preview unavailable — showing extracted text. |
| `FILE_TOO_LARGE` | 413 | PDF must be 10 MB or smaller. |
| `NOT_A_PDF` | 415 | Only PDF files are supported. |
| `TOO_MANY_PAGES` | 422 | Contracts must be 20 pages or fewer. |
| `SCANNED_PDF` | 422 | Scanned PDFs are not supported yet. |
| `CONTRACT_TOO_LONG` | 422 | This contract is too long for now (max ~15,000 tokens). Longer contract support is coming. |
| `PDF_UNREADABLE` | 422 | We couldn't read this PDF. It may be corrupted or password-protected. |
| `CUSTOM_TERM_LIMIT` | 422 | You can add up to 5 custom terms. |
| `UPLOAD_MISSING` | 424 | Upload didn't complete. Please try again. |
| `RATE_LIMITED` | 429 | You're doing that too often. Try again in a minute. |
| `INTERNAL` | 500 | Something went wrong. Please try again. |
| `AI_UNAVAILABLE` | 502 | We couldn't analyse this contract. Try again in a few minutes. |
| `AI_INVALID_OUTPUT` | 502 | We couldn't analyse this contract. Try again in a few minutes. |
| `STORAGE_UNAVAILABLE` | 503 | File storage is temporarily unavailable. |
| `AI_TIMEOUT` | 504 | Analysis took too long. Try again in a few minutes. |
| `STALE_PROCESSING` | — (stored as `contracts.error_code`, surfaced in GET detail) | Analysis was interrupted. Try again. |

Auth-only codes (Server Actions, not HTTP): `EMAIL_TAKEN`, `WEAK_PASSWORD`, `INVALID_CREDENTIALS`, `EMAIL_NOT_CONFIRMED` — see auth.md.

### Postgres error mapping (`mapPgError(err)`)

| Postgres | → AppError |
|---|---|
| `23505` on `custom_key_terms_contract_name_unique` | `CUSTOM_TERM_DUPLICATE` |
| `P0001` with message `CUSTOM_TERM_LIMIT` | `CUSTOM_TERM_LIMIT` |
| `P0002` (`CONTRACT_NOT_FOUND`) | `NOT_FOUND` |
| `23503` (FK violation — parent deleted mid-request) | `NOT_FOUND` |
| `22P02` (invalid uuid) | `VALIDATION_ERROR` |
| `42501` (permission denied) | `NOT_FOUND` (never leak existence) |
| other | rethrow → `INTERNAL` |

## 5. Client fetch helper — `src/lib/api/client.ts`

```ts
export class ApiError extends Error { code: ErrorCode; status: number; fieldErrors?: Record<string,string[]>; retryAfter?: number; }
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T>;
// - sets 'content-type: application/json' when body is a string
// - credentials: 'same-origin'
// - 204 → undefined as T
// - non-2xx → parses envelope → throws ApiError (fallback code INTERNAL)
// - 401 → window.location.assign(`/login?next=${encodeURIComponent(location.pathname)}`)
```

TanStack Query defaults (`src/app/providers.tsx`): `staleTime: 30_000`, `retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2`, `refetchOnWindowFocus: false`. Query keys:

| Key | Data |
|---|---|
| `['contracts', { sort, dir, page }]` | list |
| `['contract', id]` | detail |
| `['contract-text', id]` | text for fallback viewer |
| `['pdf-url', id]` | signed URL |
| `['chat', id]` | chat history |
| `['usage']` | quota |

## 6. Logging — `src/lib/utils/logger.ts`

`logger.info|warn|error(event: string, fields: Record<string, unknown>)` → `console.log(JSON.stringify({ ts, level, event, ...fields }))`. Redaction: keys `contractText`, `contract_text`, `content`, `message`, `sourceSentence`, `value`, `password`, `authorization` are replaced with `[redacted]` recursively. Standard fields: `requestId`, `userId`, `contractId`, `route`, `durationMs`, `code`.

Events to emit: `contract.extracted`, `contract.extract_rejected` (with code), `extraction.completed` (tokens, cost, latency, promptVersion), `extraction.failed` (code, attempts), `chat.completed` (tokens, latency, queryType, citedPages count), `chat.failed`, `rate_limit.blocked`, `quota.blocked`, `retention.run` (counts), `cost.alert`.

## 7. SSE format — `src/lib/utils/sse.ts`

Server:
```ts
export function sseEvent(event: string, data: unknown): Uint8Array; // "event: <event>\ndata: <json>\n\n"
export const SSE_HEADERS = { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' };
```
Client:
```ts
export async function* readSse(res: Response): AsyncGenerator<{ event: string; data: any }>;
// reads res.body via TextDecoderStream, buffers, splits on "\n\n", parses "event:" and "data:" lines, JSON.parse(data)
```

## 8. Server Actions

Located in route-group `actions.ts` files, `'use server'` at top. Each action: Zod-parses `FormData` → calls a service → returns `{ ok: true } | { ok: false, code, message, fieldErrors? }` (never throws to the client), or `redirect()` on success. Server Actions get Next's built-in Origin check for CSRF; Route Handlers rely on SameSite=Lax cookies + JSON content type (non-simple request).
