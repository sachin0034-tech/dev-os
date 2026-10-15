# Spec — Project Setup & Conventions

**Source:** engineering-doc.md §5.1, §6.1, §11, §12 · **Consumed by:** Stage 3 (`/frontend-setup`) and every feature spec.

---

## 1. Stack (pinned)

| Package | Version | Purpose |
|---|---|---|
| `next` | `^15.5.27` (upgraded from 14.2.x in Stage 7 — 14.x is unpatched; see `docs/security/security-plan.md` §3) | App Router, Route Handlers, Server Actions. Next 15: `cookies()`, `params`, `searchParams` are async; `serverExternalPackages` |
| `react`, `react-dom` | `^19.1` | `useActionState` replaces `useFormState` |
| `typescript` | `^5.5` | `strict: true` |
| `@supabase/supabase-js` | `^2.45.0` | DB, Storage, Auth |
| `@supabase/ssr` | `^0.5.1` | Cookie-based sessions for Next.js |
| `openai` | `^4.67.0` | Chat Completions, Structured Outputs, streaming |
| `zod` | `^3.23.8` | Validation (client + server) |
| `@tanstack/react-query` | `^5.59.0` | Server state |
| `zustand` | `^4.5.5` | Client UI state |
| `react-hook-form` · `@hookform/resolvers` | `^7.53.0` · `^3.9.0` | Forms |
| `react-pdf` | `^9.1.1` (bundles `pdfjs-dist` 4.x) | PDF viewer |
| `pdfjs-dist` (via `react-pdf`) | 4.x | Server text extraction (legacy build) — replaced `pdf-parse`, see contract-upload-and-extraction.md §5 |
| `js-tiktoken` | `^1.0.15` | Token counting (`o200k_base`) |
| `server-only` | `^0.0.1` | Build-time guard against client import |
| `tailwindcss` · `postcss` · `autoprefixer` | `^3.4.13` · `^8` · `^10` | Styling |
| `tailwindcss-animate` · `class-variance-authority` · `clsx` · `tailwind-merge` | latest | shadcn/ui utilities |
| `@radix-ui/*` (via shadcn CLI) | latest | Dialog, AlertDialog, Tooltip, Tabs, Accordion, DropdownMenu, Popover, Select, Toggle |
| `lucide-react` · `sonner` | latest | Icons, toasts |
| **Dev:** `vitest` `^2.1` · `@vitejs/plugin-react` · `@testing-library/react` `^16` · `@testing-library/jest-dom` · `jsdom` · `msw` `^2.4` · `@playwright/test` `^1.48` · `@axe-core/playwright` · `supabase` (CLI) `^1.200` · `eslint` `^8` + `eslint-config-next` 14 · `prettier` `^3` + `prettier-plugin-tailwindcss` · `tsx` | | Testing, tooling |

Node: **20 LTS** (`"engines": { "node": ">=20 <23" }`, `.nvmrc` = `20`).

## 2. `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:int": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "db:types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID --schema public > src/types/database.types.ts",
    "eval:extraction": "tsx evals/run-extraction-eval.ts",
    "eval:chat": "tsx evals/run-chat-eval.ts",
    "postinstall": "node scripts/copy-pdf-worker.mjs"
  }
}
```

`scripts/copy-pdf-worker.mjs` copies `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` → `public/pdf.worker.min.mjs` (creates `public/` if missing; exits 0 if the source is absent so CI installs never fail).

## 3. Config files

### `tsconfig.json`
- `"strict": true`, `"noUncheckedIndexedAccess": true`, `"moduleResolution": "bundler"`, `"paths": { "@/*": ["./src/*"] }`, Next plugin enabled.

### `next.config.mjs`
```js
/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: ['pdfjs-dist'] },
  webpack: (config) => { config.resolve.alias.canvas = false; return config; }, // react-pdf
  async headers() { return [{ source: '/:path*', headers: securityHeaders }]; },
};
export default nextConfig;
```
(Content-Security-Policy is defined in Stage 7 security work.)

### `vercel.json`
```json
{
  "crons": [{ "path": "/api/cron/retention", "schedule": "0 3 * * *" }],
  "functions": {
    "src/app/api/contracts/[id]/process/route.ts": { "maxDuration": 90 },
    "src/app/api/contracts/[id]/chat/route.ts": { "maxDuration": 60 },
    "src/app/api/contracts/[id]/extract/route.ts": { "maxDuration": 30 }
  }
}
```
Each of those route files also exports `export const maxDuration = <n>` and `export const runtime = 'nodejs'`.

### Others
- `tailwind.config.ts`, `globals.css` → see `design-tokens.md`.
- `components.json` (shadcn): style `default`, `rsc: true`, `tsx: true`, aliases `@/components`, `@/lib/utils`, css `src/app/globals.css`, baseColor `neutral`, cssVariables `true`.
- `.eslintrc.json`: `extends: ["next/core-web-vitals"]`, rule `no-restricted-imports` banning `@/lib/supabase/admin` and `@/lib/ai/*` from files under `src/components/**` and `src/hooks/**`.
- `.prettierrc`: `{ "singleQuote": true, "semi": true, "trailingComma": "all", "printWidth": 100, "plugins": ["prettier-plugin-tailwindcss"] }`.
- `.gitignore`: Next defaults + `.env*.local`, `public/pdf.worker.min.mjs`, `evals/results/*.json`, `playwright-report/`, `test-results/`, `supabase/.temp/`.

## 4. Folder structure

```
contractiq/
├─ .env.example · .nvmrc · next.config.mjs · vercel.json · tailwind.config.ts · postcss.config.mjs
├─ middleware.ts                       # session refresh + route protection (auth.md)
├─ scripts/copy-pdf-worker.mjs
├─ public/                             # pdf.worker.min.mjs (generated), og-image.png, favicon
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx · globals.css · not-found.tsx · error.tsx · providers.tsx (QueryClientProvider, Toaster, TooltipProvider)
│  │  ├─ (marketing)/page.tsx
│  │  ├─ (auth)/login/page.tsx · signup/page.tsx · signup/check-email/page.tsx · actions.ts
│  │  ├─ auth/callback/route.ts
│  │  ├─ (app)/layout.tsx · dashboard/{page,loading,error}.tsx · contracts/new/page.tsx · contracts/[id]/{page,loading,error,not-found}.tsx · actions.ts
│  │  └─ api/ … (see api-conventions.md §Route map)
│  ├─ components/{ui,layout,marketing,auth,dashboard,contracts,key-terms,viewer,chat,feedback,onboarding}/
│  ├─ hooks/                           # use-*.ts (TanStack Query + SSE hooks)
│  ├─ stores/                          # *-store.ts (Zustand)
│  ├─ lib/
│  │  ├─ supabase/{server,client,admin,middleware}.ts
│  │  ├─ api/{handler,errors,responses,client}.ts
│  │  ├─ services/*.service.ts
│  │  ├─ ai/{openai-client,schemas,validate-terms,classify-query,citations,cost,mock}.ts · ai/prompts/{extraction,chat}/
│  │  ├─ pdf/{extract-text,page-markers}.ts
│  │  ├─ validation/*.ts
│  │  ├─ constants/{standard-terms,plans,rate-limits,term-glossary,limits}.ts
│  │  └─ utils/{cn,logger,sse,tokens,text-normalize,slug,confidence,format}.ts
│  └─ types/{database.types,api,domain}.ts
├─ supabase/migrations/20261011000000_initial_schema.sql   # == docs/specs/supabase-schema.sql
├─ supabase/seed.sql
├─ tests/{unit,integration,e2e,fixtures/pdfs}/
└─ evals/{datasets/{nda,msa},results}/ · run-extraction-eval.ts · run-chat-eval.ts
```

## 5. Shared limits — `src/lib/constants/limits.ts`

```ts
export const MAX_FILE_BYTES = 10 * 1024 * 1024;        // 10 MB
export const MAX_DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel body limit fallback
export const MAX_PAGES = 20;
export const MIN_WORDS = 100;
export const MAX_CONTRACT_TOKENS = 15_000;
export const MAX_CUSTOM_TERMS = 5;
export const CUSTOM_TERM_MIN = 2;
export const CUSTOM_TERM_MAX = 80;
export const MAX_TERM_VALUE_CHARS = 2_000;
export const MAX_SOURCE_SENTENCE_CHARS = 1_000;
export const MAX_CHAT_MESSAGE_CHARS = 2_000;
export const MAX_CHAT_HISTORY_MESSAGES = 200;
export const MAX_CHAT_HISTORY_TOKENS = 20_000;
export const MAX_FEEDBACK_COMMENT_CHARS = 1_000;
export const SIGNED_URL_TTL_SECONDS = 3_600;
export const STALE_PROCESSING_MS = 3 * 60 * 1000;
export const PDF_RETENTION_DAYS = 90;
export const CONFIDENCE_HIGH = 80;
export const CONFIDENCE_LOW = 50;
```

## 6. Environment

All variables are listed in `/.env.example`. Access them only through `src/lib/env.ts`, which Zod-parses `process.env` once:

```ts
import 'server-only';
import { z } from 'zod';
const serverEnv = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  OPENAI_EXTRACTION_MODEL: z.string().default('gpt-4o'),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o'),
  OPENAI_PRICE_INPUT_PER_1M: z.coerce.number().positive().default(2.5),
  OPENAI_PRICE_OUTPUT_PER_1M: z.coerce.number().positive().default(10),
  COST_ALERT_DAILY_USD: z.coerce.number().positive().default(15),
  CRON_SECRET: z.string().min(32),
  AI_MOCK_MODE: z.enum(['true', 'false', '']).optional().transform((v) => v === 'true'),
});
export const env = serverEnv.parse(process.env);
```
Client code reads `process.env.NEXT_PUBLIC_*` directly via `src/lib/env.client.ts` (separate, no `server-only`). The app throws at boot if any server variable is missing. `AI_MOCK_MODE=true` is rejected when `VERCEL_ENV === 'production'`.

> Note: the engineering doc refers to `APP_URL`; the canonical name is **`NEXT_PUBLIC_APP_URL`**.

## 7. Naming conventions

As engineering-doc.md §12. Quick reference: folders & files kebab-case; React components PascalCase exports; hooks `use-*.ts` → `useX`; stores `*-store.ts` → `useXStore`; services `*.service.ts` with named exports; Zod schemas `xSchema`; constants `SCREAMING_SNAKE`; DB snake_case plural; API JSON camelCase; error codes `SCREAMING_SNAKE`; prompt versions `extract-v1.0` / `chat-v1.0`; branches `feat/F04-extraction`.

DB→API mapping is done in one place per entity: `src/lib/services/mappers.ts` (`toContractSummary`, `toContractDetail`, `toKeyTerm`, `toCustomTerm`, `toChatMessage`). No snake_case leaves the services layer.

## 8. Definition of done (every feature)

1. `npm run lint && npm run typecheck && npm test && npm run test:int` green.
2. New tables/policies covered by cross-user integration tests.
3. UI uses design tokens only (see `design-tokens.md`); keyboard and screen-reader checked.
4. No `console.log`; use `logger`. No contract text or chat content in logs.
