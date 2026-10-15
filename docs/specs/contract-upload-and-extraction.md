# Spec — F02 Contract Upload & Text Extraction

**Source:** engineering-doc.md §4.4, §9.3 #1–2 · **Stories:** US-002 · **FR:** FR-02, FR-03

---

## 1. Scope

Select contract type → upload PDF (≤ 10 MB) directly to Supabase Storage via signed upload URL → server reads it once, validates, extracts text with `[PAGE N]` markers, stores it in `contracts.contract_text`. Fallback: if Storage upload fails and file ≤ 4 MB, send the file to the API (no PDF viewer later).

## 2. Files

| File | Responsibility |
|---|---|
| `src/app/api/contracts/init/route.ts` | POST init |
| `src/app/api/contracts/[id]/extract/route.ts` | POST extract (`maxDuration = 30`) |
| `src/lib/services/contracts.service.ts` | `initContract`, `extractContract` |
| `src/lib/services/storage.service.ts` | `createUploadUrl`, `downloadPdf`, `removePdf` |
| `src/lib/pdf/extract-text.ts` | `extractPdfText(buffer)` |
| `src/lib/pdf/page-markers.ts` | `splitPages`, `findPageOf`, `stripMarkers` |
| `src/lib/utils/tokens.ts` | `countTokens(text)` |
| `src/lib/validation/contracts.ts` | Schemas |
| `src/app/(app)/contracts/new/page.tsx` | Page (reads `?resume`) |
| `src/components/contracts/{upload-wizard,contract-type-select,pdf-dropzone,upload-progress,upload-error}.tsx` | UI |
| `src/stores/upload-store.ts`, `src/hooks/use-upload-contract.ts` | State |

## 3. Validation schemas

```ts
export const contractTypeSchema = z.enum(['NDA', 'MSA']);
export const initContractSchema = z.object({
  fileName: z.string().trim().min(1).max(255).refine((n) => /\.pdf$/i.test(n), 'Must be a .pdf file'),
  fileSize: z.number().int().positive().max(MAX_FILE_BYTES, 'FILE_TOO_LARGE'),
  contractType: contractTypeSchema,
});
export const extractJsonSchema = z.object({ mode: z.literal('storage') });
export const sanitizeFileName = (n: string) =>
  n.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'contract.pdf';
```
`fileSize > MAX_FILE_BYTES` maps to `FILE_TOO_LARGE` (413), not generic 400.

## 4. API

### POST `/api/contracts/init`
`withHandler({ body: initContractSchema, rateLimit: 'upload_init' })`

1. `await assertQuota(user.id)` (usage-quota-and-rate-limits.md).
2. `admin.from('contracts').insert({ user_id, file_name: sanitizeFileName(fileName), file_size_bytes: fileSize, contract_type, status: 'uploading' }).select('id').single()`.
3. `path = \`${user.id}/${id}/source.pdf\``; `const { data } = await admin.storage.from('contracts').createSignedUploadUrl(path)`. On Storage error → still return 201 with `uploadToken: null` (client goes straight to direct mode).
4. **201** `{ contractId, storagePath: path, uploadToken: string | null, maxDirectUploadBytes: 4194304 }`.

### POST `/api/contracts/{id}/extract`
`withHandler({ params: idParamSchema })` — body parsed manually by content type:
- `application/json` → `extractJsonSchema` → mode `storage`.
- `multipart/form-data` → `formData.get('file')` must be a `File`, `size ≤ MAX_DIRECT_UPLOAD_BYTES` else `FILE_TOO_LARGE` → mode `direct`.
- anything else → `VALIDATION_ERROR`.

Service `extractContract(user, id, source)`:
1. `const c = await supabase.from('contracts').select('id,status,file_size_bytes').eq('id', id).maybeSingle()` (RLS) → null → `NOT_FOUND`; `status !== 'uploading'` → `INVALID_STATE`.
2. Buffer: storage → `admin.storage.from('contracts').download(path)`; not found → `UPLOAD_MISSING` (do not delete row; client may retry upload); other Storage error → `STORAGE_UNAVAILABLE`. Direct → `Buffer.from(await file.arrayBuffer())`.
3. `buffer.byteLength > MAX_FILE_BYTES` → reject `FILE_TOO_LARGE`.
4. `buffer.subarray(0, 5).toString('latin1') !== '%PDF-'` → reject `NOT_A_PDF`.
5. `const { text, pageCount, wordCount } = await extractPdfText(buffer)` → throws `PDF_UNREADABLE`.
6. `pageCount > MAX_PAGES` → reject `TOO_MANY_PAGES`; `wordCount < MIN_WORDS` → reject `SCANNED_PDF`; `countTokens(text) > MAX_CONTRACT_TOKENS` → reject `CONTRACT_TOO_LONG`.
7. Success: `admin.from('contracts').update({ contract_text: text, page_count, word_count, token_count, file_path: mode === 'storage' ? path : null, status: 'ready' }).eq('id', id)`; log `contract.extracted`.
8. **Reject** (steps 3–6): `removePdf(path)` (ignore errors), `admin.from('contracts').delete().eq('id', id)`, log `contract.extract_rejected { code }`, throw the AppError.
9. **200** `{ contract: ContractSummary & { pageCount, wordCount, tokenCount, hasPdf, status: 'ready' }, standardTerms: TermDefinition[] }`.

## 5. Text extraction — `src/lib/pdf/extract-text.ts`

> **Implementation change (Stage 4):** extraction uses `pdfjs-dist/legacy/build/pdf.mjs` (the same pdf.js engine as the viewer, v4) instead of `pdf-parse`. `pdf-parse` bundles pdf.js from 2017, which rejected valid modern PDFs (object streams) in testing. Behaviour is unchanged: `[PAGE N]` markers, `PDF_UNREADABLE` on invalid/encrypted files, and `extractPdfText(buffer, { maxPages })` returns only the page count when the document exceeds `maxPages`. The `pdf-parse` code below is superseded.

```ts
import 'server-only';
// Import the library entry directly: the package index runs a debug self-test when bundled.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export async function extractPdfText(buffer: Buffer) {
  let page = 0;
  const pagerender = async (pageData: any) => {
    page += 1;
    const content = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
    let lastY: number | undefined; let out = '';
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      const y = item.transform[5];
      out += lastY === undefined || Math.abs(y - lastY) < 1 ? item.str : '\n' + item.str;
      lastY = y;
    }
    return `[PAGE ${page}]\n${out.trim()}`;
  };
  let result;
  try { result = await pdfParse(buffer, { pagerender, max: 0 }); }
  catch (e) { throw new AppError('PDF_UNREADABLE', undefined, e); }
  const text = result.text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return { text, pageCount: result.numpages, wordCount: stripMarkers(text).split(/\s+/).filter(Boolean).length };
}
```
pdf-parse renders pages sequentially, so the counter equals the 1-based page number. Declare a module type in `src/types/pdf-parse.d.ts` for the deep import.

`src/lib/pdf/page-markers.ts`:
```ts
export const PAGE_MARKER = /^\[PAGE (\d+)\]$/m;
export function splitPages(text: string): { page: number; text: string }[]; // split on /\n?\[PAGE (\d+)\]\n/
export function stripMarkers(text: string): string;                       // remove marker lines
export function findPageOf(text: string, needle: string): number | null;  // normalized search, see ai-extraction-pipeline.md §6
```

`src/lib/utils/tokens.ts`: `import { getEncoding } from 'js-tiktoken'; const enc = getEncoding('o200k_base'); export const countTokens = (s: string) => enc.encode(s).length;` (encoder created once per lambda).

## 6. Client flow — `useUploadContract()`

```
selectType → onFile(file)
  client checks: type === 'application/pdf' || /\.pdf$/i; size ≤ 10 MB  (fail → inline error, no request)
  POST /init  → { contractId, storagePath, uploadToken, maxDirectUploadBytes }
  flush queued custom terms (custom-key-terms.md)
  if uploadToken:
      try browser.storage.from('contracts').uploadToSignedUrl(storagePath, uploadToken, file, { contentType: 'application/pdf' })
      → POST /{id}/extract { mode: 'storage' }
      on Storage error && file.size ≤ maxDirectUploadBytes → direct
      on Storage error && larger → step='error', code 'UPLOAD_MISSING'
  else if file.size ≤ maxDirectUploadBytes → direct
  direct: POST /{id}/extract multipart(file)
  success → step='preview', contract stored
```
Upload progress: Supabase JS doesn't expose progress; show indeterminate bar labelled "Uploading {fileName}…" then "Extracting text…".

`useUploadStore`:
```ts
type UploadStep = 'select' | 'uploading' | 'extracting' | 'preview' | 'processing' | 'error';
interface UploadState {
  step: UploadStep; contractType: 'NDA' | 'MSA' | null; file: File | null;
  contractId: string | null; contract: ContractSummary | null; error: { code: ErrorCode; message: string } | null;
  customTerms: CustomTermDraft[];   // custom-key-terms.md
  setType(t): void; setFile(f): void; reset(): void; …
}
```
`?resume={id}`: page fetches `GET /api/contracts/{id}`; status `ready` → hydrate store at `preview`; `completed` → redirect to `/contracts/{id}`; other → `/dashboard`.

## 7. Components

| Component | Props | Behaviour |
|---|---|---|
| `UploadWizard` | `resume?: ContractDetail` | Two-column ≥ 1024px: left = type + dropzone/progress; right = `KeyTermPreview`. Stacked below. Shows `QuotaExceededCard` when `useUsage().canAnalyse === false` |
| `ContractTypeSelect` | `value`, `onChange`, `disabled` | Label "Contract type"; options "NDA — Non-Disclosure Agreement", "MSA — Master Service Agreement"; locked after upload starts |
| `PdfDropzone` | `disabled`, `onFile` | `role="button"`, `tabIndex=0`, Enter/Space opens picker; hidden `<input type="file" accept="application/pdf,.pdf">`; drag states; hint text "PDF up to 10 MB · 20 pages · text-based (not scanned)"; disabled until type selected with helper "Choose a contract type first" |
| `UploadProgress` | `fileName`, `phase` | File icon + name (body-lg) + phase label (body-sm secondary) + indeterminate bar (`bg-brand`) |
| `UploadError` | `code`, `message`, `onRetry` | Danger alert with message from catalog and "Choose another file" |
| `UploadedFileSummary` | `contract` | After success: name, "{pageCount} pages · {words} words", success badge "Text extracted" |

## 8. Design

Dropzone `rounded-lg border border-dashed border-strong bg-surface p-12 text-center`; drag-over `border-brand bg-brand-tint`; disabled `opacity-60 cursor-not-allowed`. Mobile < 640px shows `info` alert "Large PDFs work best on desktop."

## 9. Edge cases

| Case | Handling |
|---|---|
| Renamed non-PDF | `NOT_A_PDF` (magic bytes) |
| Encrypted / corrupt PDF | `PDF_UNREADABLE` |
| Exactly 20 pages / 21 pages | ok / `TOO_MANY_PAGES` |
| < 100 words | `SCANNED_PDF` |
| > 15,000 tokens | `CONTRACT_TOO_LONG` |
| Tab closed mid-upload | Row stays `uploading`; cron deletes after 24 h |
| Extract called twice | Second gets `INVALID_STATE` (status no longer `uploading`) |
| Storage bucket/policies missing | Upload error → direct mode (≤ 4 MB) |
| Quota exhausted | `/init` → 402 → `QuotaExceededCard` |
| Double drop | Ignored while `step` ∈ uploading/extracting |

## Acceptance criteria

The feature is done when all of these are true:

- [ ] Contract type must be chosen before a file can be dropped or picked; the dropzone is keyboard accessible.
- [ ] A valid text-based PDF ≤ 10 MB and ≤ 20 pages uploads, shows "Text extracted" with page and word counts, and the contract row has `status = 'ready'`, `contract_text` containing `[PAGE 1]`…`[PAGE n]`, and `file_path` set.
- [ ] Each rejection shows its exact catalog message and leaves no contract row or Storage object behind: not a PDF, > 10 MB, > 20 pages, scanned (< 100 words), > 15,000 tokens, corrupt/encrypted.
- [ ] If the Storage upload fails and the file is ≤ 4 MB, extraction still succeeds via direct upload and `file_path` is null.
- [ ] Extraction happens once: processing and chat never download the PDF again (FR-03).
- [ ] A user cannot call init/extract on another user's contract (404).
- [ ] Upload is blocked with the quota card when the trial is used up (402).

## 10. Tests

- Unit: `sanitizeFileName`, `splitPages`/`stripMarkers`, `extractPdfText` on `tests/fixtures/pdfs/nda-sample.pdf` (asserts `[PAGE 1]`…`[PAGE n]` present, pageCount), `scanned.pdf` (wordCount < 100), `encrypted.pdf` (throws `PDF_UNREADABLE`).
- Integration: init → 201 & row `uploading`; extract storage mode happy path; direct multipart path sets `file_path = null`; 21-page PDF → 422 and row deleted; non-PDF → 415; second extract → 409; other user's contract id → 404; quota exhausted → 402.
- E2E: upload NDA → "Text extracted" → preview visible; scanned PDF → "Scanned PDFs are not supported yet".
