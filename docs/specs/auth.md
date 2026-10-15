# Spec — F01 Authentication

**Source:** engineering-doc.md §4.1–4.2, §9.1 · **Stories:** US-001 · **FR:** FR-01

---

> **Stage 7 security update:** sign-in and sign-out now go through `POST /api/auth/login` and `POST /api/auth/logout` (origin-checked, rate-limited, audited); a password-reset flow (`/forgot-password` → email → `/reset-password`) was added. See `docs/security/security-plan.md`.


## 1. Scope

Email + password sign-up with mandatory email verification, sign-in, sign-out, session refresh, and protection of all `(app)` routes. Single role `user`.

## 2. Files

| File | Responsibility |
|---|---|
| `middleware.ts` | Refresh session cookies; redirect rules |
| `src/lib/supabase/middleware.ts` | `updateSession(req): Promise<{ response, user }>` |
| `src/app/(auth)/actions.ts` | `signUp`, `signIn`, `signOut`, `resendVerification` |
| `src/app/auth/callback/route.ts` | PKCE code exchange |
| `src/app/(auth)/login/page.tsx`, `signup/page.tsx`, `signup/check-email/page.tsx` | Pages |
| `src/components/auth/{auth-card,login-form,signup-form,password-rules}.tsx` | UI |
| `src/app/(app)/layout.tsx` | Second-layer guard + app shell |
| `src/components/layout/user-menu.tsx` | Sign out |
| `src/lib/validation/auth.ts` | Schemas |

## 3. Validation — `src/lib/validation/auth.ts`

```ts
export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
export const passwordSchema = z.string()
  .min(8, 'At least 8 characters').max(72, 'At most 72 characters')
  .regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');
export const signUpSchema = z.object({ email: emailSchema, password: passwordSchema });
export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password'), next: z.string().optional() });
export const safeNext = (next?: string) => (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/dashboard');
```

## 4. Middleware

```ts
// middleware.ts
export async function middleware(req: NextRequest) {
  const { response, user } = await updateSession(req);
  const path = req.nextUrl.pathname;
  const isApp = path.startsWith('/dashboard') || path.startsWith('/contracts');
  const isAuthPage = path === '/login' || path === '/signup';
  if (isApp && !user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path + req.nextUrl.search)}`, req.url));
  if (isAuthPage && user) return NextResponse.redirect(new URL('/dashboard', req.url));
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|pdf.worker.min.mjs|.*\\.(?:svg|png|jpg|jpeg|webp|woff2)$).*)'] };
```
`/api/*` routes are matched (for cookie refresh) but never redirected; they return 401 JSON via `withHandler`.

`(app)/layout.tsx`: `const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login');` then loads `profiles` row for header and onboarding flag.

## 5. Server Actions

| Action | Input | Behaviour | Result |
|---|---|---|---|
| `signUp(prev, formData)` | email, password | `supabase.auth.signUp({ email, password, options: { emailRedirectTo: \`${NEXT_PUBLIC_APP_URL}/auth/callback\` } })`. Supabase returns a user with `identities: []` when the email already exists (confirmed) → `EMAIL_TAKEN` | `redirect('/signup/check-email?email=' + encodeURIComponent(email))` |
| `signIn(prev, formData)` | email, password, next | `signInWithPassword`. Map `error.code`: `invalid_credentials` → `INVALID_CREDENTIALS`; `email_not_confirmed` → `EMAIL_NOT_CONFIRMED`; `over_request_rate_limit` → `RATE_LIMITED` | `redirect(safeNext(next))` |
| `signOut()` | — | `supabase.auth.signOut()` | `redirect('/')` |
| `resendVerification(prev, formData)` | email | `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo } })`; ignore errors except rate limit | `{ ok: true }` always (no enumeration) |

Error messages:

| Code | Message |
|---|---|
| `EMAIL_TAKEN` | An account with this email already exists. Sign in instead. |
| `WEAK_PASSWORD` | Use at least 8 characters with a letter and a number. |
| `INVALID_CREDENTIALS` | Email or password is incorrect. |
| `EMAIL_NOT_CONFIRMED` | Please verify your email first. We can resend the link. |
| `RATE_LIMITED` | Too many attempts. Please wait a minute and try again. |

## 6. Callback — `GET /auth/callback`

```ts
const code = searchParams.get('code');
if (!code) return redirect('/login?error=link_expired');
const { error } = await supabase.auth.exchangeCodeForSession(code);
return error ? redirect('/login?error=link_expired') : redirect('/dashboard');
```
`/login?error=link_expired` shows a banner "This link has expired or was already used." with the resend form.

## 7. Components

| Component | Props | Behaviour |
|---|---|---|
| `AuthCard` | `title`, `subtitle?`, `children`, `footer?` | Centered, `max-w-[400px] w-full`, card recipe, `p-8 gap-6` |
| `SignupForm` | — | `useFormState(signUp)`; RHF + `zodResolver(signUpSchema)` for live client errors; password show/hide toggle (`aria-pressed`); `PasswordRules` checklist (2 rules, tick when satisfied); submit "Create account" with spinner; footer link "Already have an account? Sign in" |
| `LoginForm` | `next?`, `initialError?` | Same pattern; submit "Sign in"; on `EMAIL_NOT_CONFIRMED` shows inline "Resend verification email" button (calls `resendVerification`, 60s cooldown) |
| `CheckEmailPage` | `searchParams.email` | "Check your inbox" (H5), "We sent a verification link to {email}." Resend button (60s cooldown, countdown text) |
| `UserMenu` | `email` | DropdownMenu: email (body-sm secondary), separator, "Sign out" (form posting `signOut`) |

## 8. Design

Auth pages: `bg-surface` full height, card centered, logo "ContractIQ" (text-h5) above card. Inputs and buttons per design-tokens.md §5. Errors under fields (`text-body-sm text-danger-text`), form-level errors in a danger-tone alert box at top of card.

## 9. Edge cases

- Signed-in user visiting `/login`/`/signup` → `/dashboard` (middleware).
- Open redirect: `next` sanitized by `safeNext`.
- Unconfirmed account signs up again → Supabase resends confirmation; show check-email page.
- Expired/reused link → `/login?error=link_expired`.
- Session expires mid-use → API returns 401 → `apiFetch` redirects to `/login?next=…`.
- Password manager autofill: inputs use `autoComplete="email"`, `"new-password"` (signup), `"current-password"` (login).

## Acceptance criteria

The feature is done when all of these are true:

- [ ] A new user can sign up with email + password and lands on `/signup/check-email`; a `profiles` row exists with `plan = 'trial'` and `trial_ends_at` 14 days out.
- [ ] Clicking the verification link signs the user in and lands on `/dashboard` (US-001); an expired/used link shows the `link_expired` banner with a resend option.
- [ ] An unverified user cannot sign in and sees "Please verify your email first" with a resend button.
- [ ] Wrong credentials show "Email or password is incorrect."; field errors appear inline for invalid email or weak password.
- [ ] Sign in → sign out round trip completes in under 10 seconds (PRD US-001).
- [ ] Visiting `/dashboard` or `/contracts/*` while signed out redirects to `/login?next=…`; after sign-in the user returns to `next` (only same-site paths).
- [ ] Signed-in users visiting `/login` or `/signup` are redirected to `/dashboard`.
- [ ] Any `/api/*` request without a session returns 401 with the standard error envelope.

## 10. Tests

- Unit: `safeNext`, `passwordSchema`.
- Integration: callback with invalid code → redirect `/login?error=link_expired`; `/api/contracts` without cookie → 401 envelope.
- E2E (`auth.spec.ts`): sign up → fetch confirmation link from local Supabase Inbucket (`http://127.0.0.1:54324`) → land on `/dashboard` empty state → sign out → sign in → dashboard; wrong password shows message; `/dashboard` while signed out redirects to `/login?next=%2Fdashboard`.
