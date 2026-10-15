# Spec — F06 Contract Viewer (PDF + Text Fallback)

**Source:** engineering-doc.md §4.7, §9.3 #9 · **Stories:** US-003, US-006 · **FR:** FR-06, FR-07

---

## 1. Scope

Left pane of the results page. Primary: PDF.js viewer (`react-pdf`) from a 1-hour signed URL with lazy pages, zoom, page indicator, download. Fallback: paginated text viewer built from `contract_text` `[PAGE N]` markers. Both respond to `targetPage` + `highlightText` from key-term and citation clicks.

## 2. Files

| File | Responsibility |
|---|---|
| `src/app/api/contracts/[id]/pdf-url/route.ts` | GET signed URL |
| `src/lib/services/storage.service.ts` | `createViewUrl(path)` |
| `src/stores/viewer-store.ts` | Navigation state |
| `src/hooks/{use-pdf-url,use-contract-text}.ts` | Queries |
| `src/components/viewer/{document-pane,pdf-viewer,pdf-page,pdf-toolbar,contract-text-viewer,viewer-fallback-banner}.tsx` | UI |
| `src/lib/pdf/page-markers.ts` | `splitPages` (shared with server) |
| `src/lib/viewer/highlight.ts` | Text-match helpers for highlighting |

## 3. API — GET `/api/contracts/{id}/pdf-url`

1. Load contract (RLS) → `NOT_FOUND`.
2. `file_path === null` → **410** `PDF_UNAVAILABLE`.
3. `admin.storage.from('contracts').createSignedUrl(file_path, 3600)`; object missing → 410; other error → 503 `STORAGE_UNAVAILABLE`.
4. **200** `{ url, expiresAt: new Date(Date.now() + 3600_000).toISOString() }`.

## 4. Viewer store — `src/stores/viewer-store.ts`

```ts
interface ViewerState {
  mode: 'pdf' | 'text';
  targetPage: number | null;
  highlightText: string | null;
  navNonce: number;              // increments on every setTarget so repeated clicks re-trigger
  zoom: number;                  // 0.5 – 2.0, step 0.25, default 1 (fit width)
  currentPage: number;           // updated by IntersectionObserver
  userHasNavigated: boolean;
  setTarget(page: number, text: string | null, opts?: { auto?: boolean }): void;
  setMode(m: 'pdf' | 'text'): void;
  setZoom(z: number): void;
  setCurrentPage(p: number): void;
  reset(): void;                 // called on results page unmount
}
```

## 5. `DocumentPane` mode selection

```
if !contract.hasPdf → mode 'text' (reason: contract.pdfDeletedAt ? 'retention' : 'not_stored')
else usePdfUrl(id): success → 'pdf'; 410/503 → 'text' (reason 'unavailable')
PdfViewer onLoadError / onSourceError → 'text' (reason 'render_failed')
User toggle "View as text" / "View PDF" in toolbar (only when PDF available)
'text' mode loads text via GET /api/contracts/{id}?include=text (useContractText, staleTime Infinity)
```

`ViewerFallbackBanner` messages:
| Reason | Text |
|---|---|
| `not_stored` / `unavailable` | PDF preview unavailable — showing extracted text. |
| `retention` | The original PDF was removed after 90 days of inactivity — showing extracted text. |
| `render_failed` | We couldn't display this PDF — showing extracted text. |

## 6. `PdfViewer`

```tsx
'use client';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
```
- Imported in `DocumentPane` via `next/dynamic(() => import('./pdf-viewer'), { ssr: false })`.
- `<Document file={url} onLoadSuccess={({numPages}) => …} onLoadError={fallback} loading={<PageSkeletons/>}>`.
- Width: container width via `ResizeObserver` × `zoom`.
- Lazy rendering: each page slot is a div with height = `width × (pageHeight/pageWidth)` (aspect from first page; default 1.294 for Letter); an `IntersectionObserver` (rootMargin `200% 0px`) mounts `<Page>` for slots near the viewport (± 2 pages) and unmounts far ones. `renderAnnotationLayer={false}`, `renderTextLayer`.
- Current page: second IntersectionObserver with threshold 0.5 → `setCurrentPage`.
- Navigation effect on `[navNonce]`: `slotRefs[targetPage-1].scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })`.
- Highlight: `customTextRenderer={({ str, pageNumber, itemIndex }) => …}` for `pageNumber === targetPage` wraps items whose normalized text is contained in the normalized `highlightText` window (see §8) in `<mark class="ci-highlight">`. Highlight removed after 3 s (state timer).
- Signed URL expiry: `usePdfUrl` `staleTime: 50 * 60_000`; if `<Document>` errors with HTTP 400/403 → `refetch()` once before falling back.

`PdfToolbar` (sticky top, h-12): zoom − / + buttons (`aria-label`), zoom % (body-sm), "Fit width" button, page indicator "Page {current} / {total}" with a numeric input to jump (Enter), "View as text" toggle, download link (`<a href={url} download={fileName}>`).

## 7. `ContractTextViewer`

- `splitPages(contractText)` → `<section id="page-{n}" aria-label="Page {n}" className="bg-primary border rounded-lg p-6">` with sticky header "Page {n}" (body-sm secondary) and text paragraphs (`whitespace-pre-wrap text-body-lg`).
- Same navigation effect on `navNonce` (scroll to `#page-{n}`).
- Highlight: find `highlightText` in page text using `normalizeForMatch` index mapping (§8); wrap the original-text range in `<mark>`; if not found → no highlight.
- Current page tracked by IntersectionObserver.

## 8. Highlight matching — `src/lib/viewer/highlight.ts`

```ts
// Builds a normalized string plus a map from normalized index → original index, so a match on
// normalized text can be wrapped in the original text.
export function buildNormalizedIndex(original: string): { norm: string; map: number[] };
export function findRange(original: string, needle: string): [start: number, end: number] | null;
// For PDF text layer: true if the normalized item string (≥ 3 chars) occurs inside the normalized needle
export function itemInNeedle(itemStr: string, needleNorm: string): boolean;
```
Uses the same normalization as `normalizeForMatch` (ai-extraction-pipeline.md §6), excluding the hyphen-newline join.

## 9. Design

Pane `bg-subtle`, `p-4`, pages centered with `gap-4`; each PDF page `bg-primary border border-default`. `.ci-highlight { background: var(--highlight); color: inherit; border-radius: 2px; transition: background-color 300ms ease-in-out; }`. Toolbar `bg-primary border-b border-default`. Skeleton pages `bg-primary` with `animate-pulse` lines.

## 10. Edge cases

| Case | Handling |
|---|---|
| `pageNumber` null | No navigation (PageLink disabled) |
| Target page > numPages | Clamp to last page |
| Highlight text not in text layer | Scroll only |
| Unusual fonts render badly | User toggles "View as text" |
| 10 MB / 20-page PDF | Lazy mount keeps ≤ 5 canvases alive |
| PDF deleted by retention while open | Next URL refetch → 410 → text mode with retention banner |
| Mobile | Document is its own tab; navigation switches to it |

## Acceptance criteria

The feature is done when all of these are true:

- [ ] The PDF renders all pages inline with zoom in/out, fit-width, page indicator and download (US-006).
- [ ] Clicking a term's page link (or a chat citation) scrolls the viewer to that page and highlights the source sentence when it can be matched (US-003, FR-07).
- [ ] When the PDF is unavailable (not stored, deleted after 90 days, or fails to render) the text viewer shows the contract by page with a banner, and navigation still works (FR-06).
- [ ] The signed PDF URL expires after 1 hour and is refreshed automatically while the page is open.
- [ ] Only ~5 pages are rendered at a time, so a 20-page / 10 MB PDF scrolls smoothly.

## 11. Tests

- Unit: `buildNormalizedIndex`/`findRange` (curly quotes, extra spaces, multi-line); `ContractTextViewer` scrolls to `#page-3` on `navNonce` change (jsdom `scrollIntoView` mocked); fallback banner reasons.
- Integration: pdf-url 410 when `file_path` null; 200 shape; other user 404.
- E2E: click "p. 2" → page 2 slot in viewport; force PDF unavailable (contract created via direct mode) → text viewer with banner, navigation still works.
