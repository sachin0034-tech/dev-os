# Spec — F13 Landing Page, Disclaimers & Onboarding

**Source:** engineering-doc.md §4.1, §10 (F13) · PRD Flow 1, §9 UI guardrails, §11 disclosures

---

## 1. Scope

- Static marketing landing page at `/` with value proposition and two CTAs.
- Global disclosures: "Not legal advice" disclaimer on every results page (results-page-and-key-terms.md), "Powered by OpenAI GPT-4o" in app and marketing footers.
- First-run onboarding: 3-step tooltip tour on the first results page visit.

## 2. Files

| File | Responsibility |
|---|---|
| `src/app/(marketing)/page.tsx` | Landing (static; reads session only to swap CTA) |
| `src/components/marketing/{landing-header,landing-hero,value-props,how-it-works,demo-media,cta-section,marketing-footer}.tsx` | Sections |
| `src/components/layout/{app-header,app-footer}.tsx` | App shell |
| `src/components/onboarding/onboarding-tour.tsx` | Tour |
| `src/app/(app)/actions.ts` | `completeOnboarding()` |
| `src/app/layout.tsx` | Root metadata, font, providers |

## 3. Landing content (exact copy)

| Section | Content |
|---|---|
| Header | Logo "ContractIQ" · links "Sign in" (ghost) · "Get Started Free" (primary). Signed-in: single "Go to dashboard" (primary) |
| Hero | H1 "Understand any NDA or MSA in minutes, not hours." · body "Upload a contract and ContractIQ pulls out the terms that matter — with the page each one came from and how confident we are — then answers your questions using only what the document says." · CTAs "Get Started Free" → `/signup`, "Sign in" → `/login` · caption "14-day free trial · 5 contract reviews · No card required" |
| Value props (3) | **Page-level references** — "Every term links to the page it came from, so you can check it in one click." · **Confidence you can see** — "Each term shows a confidence score. Low-confidence terms are flagged so you know what to double-check." · **Chat grounded in your document** — "Ask questions in plain English. Answers cite pages and never draw on outside guesses." |
| How it works | 1 "Upload your NDA or MSA (PDF, up to 20 pages)" · 2 "Review key terms with page numbers and confidence" · 3 "Ask follow-up questions and correct anything we got wrong" |
| Demo media | `DemoMedia`: static screenshot `public/landing/results-preview.png` (1600×1000, alt "ContractIQ results page showing key terms next to the contract") — GIF replaced later without code change |
| CTA section | H5 "Stop signing contracts you haven't fully read." + "Get Started Free" |
| Footer | "ContractIQ is an AI-assisted review tool, not legal advice." · "Powered by OpenAI GPT-4o" · "© 2026 ContractIQ" |

Metadata (`src/app/layout.tsx`): title template `%s · ContractIQ`, default "ContractIQ — AI review for NDAs and MSAs"; description = hero body; `openGraph.images` `/og-image.png`; `robots` index for `/` only (`(app)` and `(auth)` layouts export `robots: { index: false }`).

## 4. App shell

`AppHeader` (h-16, `bg-primary border-b`): logo → `/dashboard`; "Review a Contract" (primary sm, hidden on `/contracts/new`); `UserMenu`. `AppFooter` (body-sm secondary, `py-4 text-center`): "Powered by OpenAI GPT-4o · Not legal advice". On the results page the footer is hidden (full-height layout); the disclaimer banner covers the disclosure there.

## 5. Onboarding tour

- Trigger: results page with `status === 'completed'` and `profile.onboarding_completed_at === null`.
- Steps (anchored via `data-tour` attributes on the first `KeyTermCard`):
  1. `confidence` → "Confidence score — Green is high, amber medium, red low. Red terms show a warning: always check them."
  2. `page-link` → "Jump to the source — Click a page number to see exactly where this term appears."
  3. `chat-tab` → "Ask questions — Chat answers only from this document and cites pages."
- Controls: "Next" / "Back" / "Skip tour"; last step "Got it". Esc = skip. Focus moves into the popover; returns to the anchor on close.
- Finish or skip → `completeOnboarding()` Server Action: `supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', user.id)`; local state hides the tour immediately.
- Missing anchor (e.g. mobile tab not visible) → skip that step.

`OnboardingTour` props: `steps: { anchor: string; title: string; body: string }[]`, `onDone(): void`. Built with Radix Popover positioned to `document.querySelector('[data-tour="…"]')`.

## 6. Design

Landing uses the page wrapper (`xl:px-28 xl:py-24`), sections separated by 64px, alternating `bg-primary` / `bg-surface`. Flat (no gradients, no shadows). H1 only in hero. Value props `grid md:grid-cols-3 gap-6`, each a card with a lucide icon (`FileSearch`, `Gauge`, `MessagesSquare`) in `text-brand`. Tour popover: `bg-primary border rounded-lg p-4 max-w-[280px]`, title body-lg, body body-sm secondary, step counter "1 of 3".

## 7. Edge cases

- Signed-in user on `/` → header and hero CTA show "Go to dashboard".
- `prefers-reduced-motion` → no popover animation.
- Profile update fails → tour still hidden locally; reappears next visit (acceptable).

## Acceptance criteria

The feature is done when all of these are true:

- [ ] `/` renders the hero, value props, how-it-works, demo image, CTA section and footer with the exact copy in §3; no console errors.
- [ ] "Get Started Free" goes to `/signup`, "Sign in" to `/login`; a signed-in visitor sees "Go to dashboard" instead.
- [ ] Every app page shows the footer "Powered by OpenAI GPT-4o · Not legal advice" (results page uses the disclaimer banner instead).
- [ ] On a user's first completed results page the 3-step tour appears; Skip or Got it hides it permanently (`profiles.onboarding_completed_at` set).
- [ ] axe reports 0 serious/critical violations on `/`; layout has no horizontal scroll at 375px.

## 8. Tests

- E2E (`landing.spec.ts`): `/` renders hero and both CTAs; "Get Started Free" → `/signup`; axe: 0 serious/critical.
- E2E: first results visit shows tour step 1; Skip → reload → no tour.
- Unit: `OnboardingTour` skips missing anchors.
