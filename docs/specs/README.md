# ContractIQ — Implementation Specs (Stage 2)

Generated from `docs/engineering/engineering-doc.md` and `docs/engineering/implementation-specs.md` (Stage 1). Each file is self-contained: a developer can build its concern from that file plus the shared foundations.

## Index

### Foundations (read first)
| File | Specifies |
|---|---|
| [project-setup-and-conventions.md](project-setup-and-conventions.md) | Pinned stack, scripts, config files, folder layout, shared limits, env loading, naming, definition of done |
| [design-tokens.md](design-tokens.md) | `globals.css` tokens, `tailwind.config.ts`, type roles, component recipes, domain → badge mappings |
| [api-conventions.md](api-conventions.md) | Route map, Supabase clients, `withHandler`, error catalog & envelope, PG error mapping, client fetch, logging, SSE, Server Actions |
| [database.md](database.md) | How to apply the schema, object list, status lifecycle, RLS/privilege matrix, RPC payloads, Storage conventions, seeding |
| [supabase-schema.sql](supabase-schema.sql) | **Paste-and-run** SQL: enums, tables, indexes, triggers, RPCs, views, RLS, grants, Storage bucket + policies |
| [contractiq/.env.example](../../contractiq/.env.example) | Every environment variable, grouped by service |

### Features (build order)
| # | File | Feature |
|---|---|---|
| F01 | [auth.md](auth.md) | Sign up / verify / sign in / sign out, middleware protection |
| F13a | [landing-and-onboarding.md](landing-and-onboarding.md) | Landing page, footers/disclosures (onboarding tour built last) |
| F02 | [contract-upload-and-extraction.md](contract-upload-and-extraction.md) | Signed upload, PDF validation, text extraction with `[PAGE N]` |
| F04 | [ai-extraction-pipeline.md](ai-extraction-pipeline.md) | GPT-4o prompt, structured output, post-validation, persistence, cost |
| F05 | [results-page-and-key-terms.md](results-page-and-key-terms.md) | Results layout, key-term cards, confidence, warnings, "Why?" |
| F03 | [custom-key-terms.md](custom-key-terms.md) | Standard term catalogue, preview, up to 5 custom terms |
| F06 | [contract-viewer.md](contract-viewer.md) | PDF viewer, text fallback, page navigation, highlighting |
| F07 | [key-term-editing.md](key-term-editing.md) | Inline edit, revert, immutable original value |
| F09 | [dashboard.md](dashboard.md) | Summary cards, usage meter, sortable contract table |
| F08 | [contract-chat.md](contract-chat.md) | Grounded chat over SSE, citations, persistence |
| F11 | [usage-quota-and-rate-limits.md](usage-quota-and-rate-limits.md) | Trial quota, plan limits, rate limits, cost logging |
| F10 | [feedback.md](feedback.md) | Thumbs up/down + comment |
| F12 | [retention-and-deletion.md](retention-and-deletion.md) | Contract deletion, 90-day PDF retention cron, cleanup |
| F13b | [landing-and-onboarding.md](landing-and-onboarding.md) | Onboarding tour |

### Quality
| File | Specifies |
|---|---|
| [testing-and-evals.md](testing-and-evals.md) | Test pyramid, configs, fixtures, required test inventory, AI eval datasets/scoring/gates, CI, load test |

## Verification status

`supabase-schema.sql` was executed twice (idempotency) against a clean PostgreSQL instance with Supabase `auth`/`storage` stubs, and 20 behavioural RLS/constraint checks passed. Note: the local check used PostgreSQL 14 with `security_invoker` removed from the two views; Supabase runs PostgreSQL 15+, where that option is supported.
