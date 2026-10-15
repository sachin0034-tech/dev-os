# Spec — F11 Usage Quota & Rate Limiting

**Source:** engineering-doc.md §4.12, §8.5, §9.3 #14 · Decision D6 (usage quota only, no Stripe) · PRD §5 cost, §12 pricing

---

> **Stage 7 security update:** rate limiting is now a Supabase **sliding window** (`rate_limit_events` + `rate_limit_hit` RPC) in `src/lib/security/rateLimiter.ts`, with limits auth 10/min (per IP and per email), chat 30/min, process 5/h, upload 20/day — see `docs/security/security-plan.md` §2.1. The fixed-window `rate_limits` design below is superseded.


## 1. Scope

- **Quota:** trial users get 5 *successful* analyses within 14 days of sign-up. Paid plan limits exist in config (set manually in DB for now). Enforced on `/init` and `/process`.
- **Rate limits:** per-user fixed windows via `check_rate_limit` RPC. Return 429 + `Retry-After`.
- **Usage summary** for UI meter.
- **Cost logging** for every OpenAI call (`usage_events`).

## 2. Files

| File | Responsibility |
|---|---|
| `src/lib/constants/plans.ts` | Plan limits |
| `src/lib/constants/rate-limits.ts` | Rate-limit table |
| `src/lib/services/usage.service.ts` | `getUsage`, `assertQuota`, `logUsage` |
| `src/lib/services/rate-limit.service.ts` | `assertRateLimit` |
| `src/app/api/usage/route.ts` | GET |
| `src/hooks/use-usage.ts` | Query `['usage']` |
| `src/components/dashboard/usage-meter.tsx`, `src/components/contracts/quota-exceeded-card.tsx` | UI |

DB: `profiles.plan`, `profiles.trial_ends_at`, `usage_events` (+ `usage_events_quota_idx`), `rate_limits`, `check_rate_limit()`.

## 3. Plans — `src/lib/constants/plans.ts`

```ts
export type Plan = 'trial' | 'starter' | 'growth' | 'pro';
export const PLANS: Record<Plan, { label: string; analyses: number | null; period: 'trial' | 'month' }> = {
  trial:   { label: 'Free trial', analyses: 5,    period: 'trial' },
  starter: { label: 'Starter',    analyses: 10,   period: 'month' },
  growth:  { label: 'Growth',     analyses: 40,   period: 'month' },
  pro:     { label: 'Pro',        analyses: null, period: 'month' },   // unlimited
};
```
Upgrading a user (MVP, manual): `update public.profiles set plan = 'starter' where email = '…';` in SQL Editor (service role).

## 4. Usage service

```ts
export interface Usage {
  plan: Plan; periodStart: string; periodEnd: string;
  analysesUsed: number; analysesLimit: number | null;
  canAnalyse: boolean; reason: 'TRIAL_EXHAUSTED' | 'TRIAL_EXPIRED' | 'PLAN_LIMIT' | null;
}

export async function getUsage(userId: string): Promise<Usage> {
  const profile = admin.from('profiles').select('plan, trial_ends_at, created_at').eq('id', userId).single();
  const cfg = PLANS[profile.plan];
  const [start, end] = cfg.period === 'trial'
    ? [profile.created_at, profile.trial_ends_at]
    : [startOfUtcMonth(now), startOfNextUtcMonth(now)];
  const used = admin.from('usage_events').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('event_type', 'extraction').eq('success', true)
    .gte('created_at', start).lt('created_at', end).count;
  let reason = null;
  if (cfg.period === 'trial' && now >= trial_ends_at) reason = 'TRIAL_EXPIRED';
  else if (cfg.analyses !== null && used >= cfg.analyses) reason = cfg.period === 'trial' ? 'TRIAL_EXHAUSTED' : 'PLAN_LIMIT';
  return { plan, periodStart: start, periodEnd: end, analysesUsed: used, analysesLimit: cfg.analyses, canAnalyse: reason === null, reason };
}

export async function assertQuota(userId: string) {
  const u = await getUsage(userId);
  if (!u.canAnalyse) { logger.warn('quota.blocked', { userId, reason: u.reason }); throw new AppError('QUOTA_EXCEEDED', { reason: u.reason }); }
}

export async function logUsage(e: {
  userId: string; contractId: string | null; eventType: 'extraction' | 'chat'; model: string; promptVersion: string;
  promptTokens: number; completionTokens: number; latencyMs: number; success: boolean; errorCode?: string;
}): Promise<void>;   // admin insert; cost_usd = calcCostUsd(...); never throws (logs on failure)
```

## 5. Rate limits — `src/lib/constants/rate-limits.ts`

```ts
export const RATE_LIMITS = {
  upload_init:   { limit: 20,  windowSec: 3600,  failOpen: false },
  process:       { limit: 10,  windowSec: 3600,  failOpen: false },
  chat:          { limit: 30,  windowSec: 60,    failOpen: true },
  chat_daily:    { limit: 300, windowSec: 86400, failOpen: true },
  key_term_edit: { limit: 120, windowSec: 60,    failOpen: true },
  feedback:      { limit: 30,  windowSec: 3600,  failOpen: true },
} as const;
export type RateLimitName = keyof typeof RATE_LIMITS;
```

```ts
export async function assertRateLimit(name: RateLimitName, userId: string) {
  const { limit, windowSec, failOpen } = RATE_LIMITS[name];
  const { data, error } = await admin.rpc('check_rate_limit', { p_key: `${name}:${userId}`, p_limit: limit, p_window_seconds: windowSec });
  if (error) { logger.error('rate_limit.error', { name, userId, code: error.code }); if (failOpen) return; throw new AppError('INTERNAL'); }
  if (data === false) {
    const retryAfterSeconds = windowSec - (Math.floor(Date.now() / 1000) % windowSec);
    logger.warn('rate_limit.blocked', { name, userId });
    throw new AppError('RATE_LIMITED', { retryAfterSeconds });
  }
}
```

## 6. API — GET `/api/usage`

`withHandler({})` → `getUsage(user.id)` → **200** `Usage`. Errors 401.

## 7. Components

| Component | Behaviour |
|---|---|
| `UsageMeter` | dashboard.md §6 |
| `QuotaExceededCard` (props `reason`) | Card with `warning-tint` header strip. Title (H5): `TRIAL_EXHAUSTED` "You've used your free trial" · `TRIAL_EXPIRED` "Your free trial has ended" · `PLAN_LIMIT` "You've reached this month's limit". Body: "Paid plans are coming soon. Join the waitlist and we'll let you know." Primary CTA "Join the waitlist" → `mailto:${NEXT_PUBLIC_SUPPORT_EMAIL}?subject=ContractIQ%20waitlist`. Secondary "Back to dashboard". Existing contracts and chat remain fully usable |

`useUsage()` → `['usage']`, `staleTime: 60_000`; invalidated after successful process.

## 8. Edge cases

- Failed extractions (`success=false`) never count.
- Deleting contracts doesn't restore quota (`usage_events.contract_id` → NULL).
- Concurrent processes at 4/5 could both succeed (6 analyses) — accepted for MVP.
- Trial expiry checked at request time; no cron needed.
- Rate-limit DB error: fail closed for `upload_init`/`process` (cost-bearing), fail open for others.
- `Retry-After` header set by `toErrorResponse` from `meta.retryAfterSeconds`.

## Acceptance criteria

The feature is done when all of these are true:

- [ ] A trial user can complete 5 successful analyses; the 6th is blocked with the "You've used your free trial" card and a 402 from the API.
- [ ] After 14 days the trial is blocked with "Your free trial has ended".
- [ ] Failed analyses never count; deleting contracts never restores quota.
- [ ] Exceeding a rate limit returns 429 with `Retry-After`, and the UI explains when to try again.
- [ ] Users cannot modify their own plan or usage records.
- [ ] Changing `profiles.plan` to `pro` in SQL gives unlimited analyses immediately.

## 9. Tests

- Unit: `retryAfterSeconds` computation; plan period boundaries (UTC month start/end).
- Integration: 5 successful usage rows → `/init` and `/process` 402 with `reason`; failed rows don't count; expired trial → 402 `TRIAL_EXPIRED`; `plan='pro'` unlimited; 11th process in an hour → 429 with `Retry-After`; user cannot insert/delete `usage_events` via their JWT.
- E2E: seed user with 5 analyses → upload page shows QuotaExceededCard.
