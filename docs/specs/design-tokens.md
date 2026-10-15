# Spec — Design Tokens & UI Primitives

**Source:** `docs/design.md` (allNeurons design system), engineering-doc.md §5.5 · **Applies to:** all frontend code (`/design-system` skill).

Rule: components use **semantic Tailwind classes only** (`text-primary`, `bg-surface`, `border-subtle`, `bg-success-tint`…). Raw primitives (`grey-500`, `blue-500`) appear only in `tailwind.config.ts` and `globals.css`.

---

## 1. `src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Primitives (docs/design.md) */
    --grey-900:#070A0E; --grey-800:#151719; --grey-700:#25272B; --grey-600:#2C2F32; --grey-500:#4A4C4F;
    --grey-400:#5E6062; --grey-300:#8F9193; --grey-200:#C1C2C3; --grey-100:#DADADB; --grey-50:#F0F0F1; --grey-25:#FAFAFA;
    --blue-700:#0D469E; --blue-500:#115ACB; --blue-200:#92B7F0; --blue-50:#E7EFFC;
    --green-700:#0D720A; --green-500:#13A10E; --green-200:#92D490; --green-50:#E7F6E7;
    --red-700:#942528; --red-500:#D13438; --red-200:#EAA2A3; --red-50:#FAEBEB;
    --yellow-800:#B36800; --yellow-500:#FFAA33; --yellow-200:#FFE3BD; --yellow-50:#FFF9F0;
    --violet-700:#6600CC; --violet-500:#7F00FF; --violet-200:#E3C7FF; --violet-50:#F7F0FF;

    /* Semantic tokens */
    --text-primary: var(--grey-900);
    --text-secondary: var(--grey-500);
    --text-disabled: var(--grey-400);
    --text-on-brand: #FFFFFF;
    --bg-primary: #FFFFFF;
    --bg-surface: var(--grey-25);
    --bg-subtle: var(--grey-50);
    --bg-pressed: var(--grey-100);
    --border-default: var(--grey-100);
    --border-strong: var(--grey-200);
    --brand: var(--blue-500);
    --brand-hover: var(--blue-700);
    --brand-tint: var(--blue-50);
    --focus-ring: var(--blue-500);
    --success: var(--green-500); --success-tint: var(--green-50); --success-border: var(--green-200); --success-text: var(--green-700);
    --danger: var(--red-500);    --danger-tint: var(--red-50);    --danger-border: var(--red-200);    --danger-text: var(--red-700);
    --warning: var(--yellow-500); --warning-tint: var(--yellow-50); --warning-border: var(--yellow-200); --warning-text: var(--yellow-800);
    --info: var(--blue-500);     --info-tint: var(--blue-50);     --info-border: var(--blue-200);     --info-text: var(--blue-700);
    --accent: var(--violet-500); --accent-tint: var(--violet-50); --accent-border: var(--violet-200); --accent-text: var(--violet-700);
    --highlight: var(--yellow-200);
  }
  html { -webkit-font-smoothing: antialiased; }
  body { @apply bg-surface font-sans text-primary; letter-spacing: 0; }
  :focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }
}
```

## 2. `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss';
const v = (name: string) => `var(--${name})`;
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['var(--font-inter-display)', 'system-ui', 'sans-serif'] },
      colors: {
        primary: v('text-primary'), secondary: v('text-secondary'), disabled: v('text-disabled'), 'on-brand': v('text-on-brand'),
        brand: { DEFAULT: v('brand'), hover: v('brand-hover'), tint: v('brand-tint') },
        success: { DEFAULT: v('success'), tint: v('success-tint'), border: v('success-border'), text: v('success-text') },
        danger:  { DEFAULT: v('danger'),  tint: v('danger-tint'),  border: v('danger-border'),  text: v('danger-text') },
        warning: { DEFAULT: v('warning'), tint: v('warning-tint'), border: v('warning-border'), text: v('warning-text') },
        info:    { DEFAULT: v('info'),    tint: v('info-tint'),    border: v('info-border'),    text: v('info-text') },
        accent:  { DEFAULT: v('accent'),  tint: v('accent-tint'),  border: v('accent-border'),  text: v('accent-text') },
        highlight: v('highlight'),
      },
      backgroundColor: { primary: v('bg-primary'), surface: v('bg-surface'), subtle: v('bg-subtle'), pressed: v('bg-pressed') },
      textColor: { primary: v('text-primary'), secondary: v('text-secondary') },
      borderColor: { DEFAULT: v('border-default'), default: v('border-default'), strong: v('border-strong') },
      borderRadius: { sm: '4px', md: '6px', lg: '8px', xl: '12px' },
      spacing: { 18: '72px', 24: '96px', 28: '112px' }, // 4px grid; Tailwind defaults (1=4px) otherwise
      fontSize: {
        h1: ['48px', { lineHeight: '56px', fontWeight: '700' }],
        h2: ['36px', { lineHeight: '44px', fontWeight: '700' }],
        h3: ['30px', { lineHeight: '38px', fontWeight: '600' }],
        h4: ['28px', { lineHeight: '36px', fontWeight: '600' }],
        h5: ['24px', { lineHeight: '32px', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'body-sm': ['12px', { lineHeight: '18px', fontWeight: '400' }],
      },
      transitionDuration: { micro: '100ms', tooltip: '150ms', enter: '200ms', exit: '150ms', page: '250ms', fade: '300ms' },
      boxShadow: { none: 'none' },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
```

Font: Inter Display, self-hosted via `next/font/local` in `src/app/layout.tsx` (`src/app/fonts/InterDisplay-{Regular,Medium,SemiBold,Bold}.woff2`, weights 400/500/600/700, `variable: '--font-inter-display'`, `display: 'swap'`). Download from rsms.me/inter (Inter Display family, SIL OFL).

## 3. Type roles

| Role | Class | Use |
|---|---|---|
| H1 | `text-h1` | Landing hero only |
| H5 | `text-h5` | Section titles, page titles in app, stat values |
| Body large | `text-body-lg` | Body copy, list items, term names, values, buttons |
| Body small | `text-body-sm` | Captions, metadata, page refs, badges, helper/error text |

Never adjust letter-spacing. Never use H2–H4 inside the app shell.

## 4. Layout

- App page wrapper: `px-4 py-6 md:px-12 md:py-12 xl:px-28 xl:py-24 flex flex-col gap-10`.
- Section: `flex flex-col gap-6`. Label rows: `gap-2`. Stacked label/sub-value: `gap-0.5` (2px).
- Cards/panels: `bg-primary border border-default rounded-lg p-4` (no shadow).
- Results page is full-height (`h-[calc(100dvh-64px)]`) and ignores the 96/112px page padding.

## 5. Component recipes (shadcn restyled)

| Component | Classes / variants |
|---|---|
| Button `primary` | `h-10 px-4 rounded-md bg-brand text-on-brand text-body-lg hover:bg-brand-hover duration-micro ease-out disabled:bg-subtle disabled:text-disabled` |
| Button `secondary` | `h-10 px-4 rounded-md bg-primary border border-default text-primary hover:bg-subtle` |
| Button `ghost` | `h-10 px-3 rounded-md text-primary hover:bg-subtle` |
| Button `destructive` | `h-10 px-4 rounded-md bg-danger text-on-brand hover:opacity-90` |
| Button `sm` size | `h-8 px-3 text-body-sm` |
| Input / Textarea / Select trigger | `h-10 rounded-md border border-default bg-primary px-3 text-body-lg placeholder:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand duration-micro aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-tint` |
| Field error | `text-body-sm text-danger-text mt-1` |
| Badge (status) | `inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-body-sm font-medium` + tone: `success` → `bg-success-tint border-success-border text-success-text`; `warning` → `bg-warning-tint border-warning-border text-warning-text`; `danger` → `bg-danger-tint border-danger-border text-danger-text`; `info` → `bg-info-tint border-info-border text-info-text`; `accent` → `bg-accent-tint border-accent-border text-accent-text`; `neutral` → `bg-subtle border-default text-secondary` |
| Card | `rounded-lg border border-default bg-primary p-4` |
| Dialog | `rounded-xl bg-primary p-6`; enter `duration-enter ease-out`, exit `duration-exit ease-in`; overlay `bg-[rgb(7_10_14/0.4)]` (Grey 900 at 40%) |
| Tooltip | `rounded-md bg-[var(--grey-900)] text-on-brand text-body-sm px-2 py-1 duration-tooltip` |
| Tabs | list `border-b border-default`; trigger active `text-primary border-b-2 border-brand`, inactive `text-secondary` |
| Table | `bg-primary rounded-lg border border-default`; header `text-body-sm text-secondary`; row `h-12 border-t border-default hover:bg-subtle` |
| Skeleton | `bg-subtle animate-pulse rounded-md` |
| Toast (sonner) | `bg-primary border border-default rounded-lg text-body-lg`; error toasts add left 2px `border-danger` |

## 6. Domain mappings

| Domain value | Badge tone | Label | Icon (lucide) |
|---|---|---|---|
| confidence ≥ 80 | success | `92% · High` | `CircleCheck` |
| confidence 50–79 | warning | `64% · Medium` | `CircleMinus` |
| confidence < 50 | danger | `31% · Low` | `TriangleAlert` |
| Custom term | accent | `Custom` | — |
| Edited term | info | `Edited` | `Pencil` |
| status `ready` | info | `Ready to process` | — |
| status `processing` | info | `Processing` | `Loader2` (spin) |
| status `completed` | success | `Reviewed` | — |
| status `error` | danger | `Failed` | — |
| NDA / MSA type | neutral | `NDA` / `MSA` | — |

Shared helper `src/lib/utils/confidence.ts`:
```ts
export type ConfidenceBand = 'high' | 'medium' | 'low';
export const confidenceBand = (s: number): ConfidenceBand => (s >= 80 ? 'high' : s >= 50 ? 'medium' : 'low');
```

## 7. Accessibility rules

- Status is never color-only: badges always carry text + icon.
- Minimum hit target 32×32px (`h-8`), primary actions 40px (`h-10`).
- Every icon-only button has `aria-label`.
- Contrast: warning text uses `warning-text` (Yellow 800), never Yellow 500 on white.
- Live regions: processing stepper and chat log use `aria-live="polite"`.
