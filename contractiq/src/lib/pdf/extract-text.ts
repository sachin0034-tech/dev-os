import 'server-only';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { AppError } from '@/lib/api/errors';
import { stripMarkers } from './page-markers';

export interface ExtractedPdf {
  text: string;
  pageCount: number;
  wordCount: number;
}

interface AnnotationLike {
  subtype?: string;
  fieldType?: string;
  fieldName?: string;
  fieldValue?: unknown;
  exportValue?: unknown;
  checkBox?: boolean;
  radioButton?: boolean;
  contentsObj?: { str?: string };
}

const asText = (v: unknown): string =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(', ') : typeof v === 'string' ? v : '';

// Filled-in values of fillable forms (e.g. ACORD certificates) live in form-field annotations,
// not in the page's text content, so getTextContent() misses them. Collect them per page.
async function formValues(page: { getAnnotations(o: { intent: string }): Promise<unknown[]> }): Promise<string[]> {
  const out: string[] = [];
  for (const raw of (await page.getAnnotations({ intent: 'display' })) as AnnotationLike[]) {
    if (raw.subtype === 'Widget') {
      if (raw.checkBox || raw.radioButton) {
        const on = asText(raw.fieldValue);
        if (on && on !== 'Off' && raw.fieldName) out.push(`[x] ${raw.fieldName}`);
        continue;
      }
      const value = asText(raw.fieldValue).trim();
      if (value) out.push(value);
    } else if (raw.subtype === 'FreeText' && raw.contentsObj?.str?.trim()) {
      out.push(raw.contentsObj.str.trim());
    }
  }
  return out;
}

interface TextItemLike {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
}

// Extracts text page by page with "[PAGE N]" markers (docs/specs/contract-upload-and-extraction.md §5).
// Uses the same pdf.js engine as the in-browser viewer (pdfjs-dist), which handles modern PDFs
// (object streams, newer compression) that older parsers reject.
// When the document has more than `maxPages` pages, only the count is returned (no text).
// pdf.js loads its worker with a dynamic import that serverless bundlers can't trace, so the
// file is missing on Vercel. Importing it up front registers it as globalThis.pdfjsWorker,
// which pdf.js uses directly (no file lookup) and guarantees it ships with the function.
let workerReady: Promise<unknown> | undefined;
const ensureWorker = () => (workerReady ??= import('pdfjs-dist/legacy/build/pdf.worker.mjs'));

export async function extractPdfText(buffer: Buffer, opts: { maxPages?: number } = {}): Promise<ExtractedPdf> {
  await ensureWorker();
  let doc;
  try {
    doc = await getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
    }).promise;
  } catch (err) {
    // InvalidPDFException, PasswordException (encrypted), MissingPDFException…
    throw new AppError('PDF_UNREADABLE', undefined, { cause: err });
  }

  try {
    const pageCount = doc.numPages;
    if (opts.maxPages !== undefined && pageCount > opts.maxPages) {
      return { text: '', pageCount, wordCount: 0 };
    }

    const pages: string[] = [];
    for (let n = 1; n <= pageCount; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let out = '';
      let lastY: number | undefined;
      for (const raw of content.items as TextItemLike[]) {
        if (typeof raw.str !== 'string') continue;
        const y = raw.transform?.[5];
        if (lastY !== undefined && y !== undefined && Math.abs(y - lastY) >= 1 && !out.endsWith('\n')) out += '\n';
        out += raw.str;
        if (raw.hasEOL) out += '\n';
        if (y !== undefined) lastY = y;
      }
      const fields = await formValues(page);
      const body = out.replace(/[ \t]+\n/g, '\n').trim();
      pages.push(`[PAGE ${n}]\n${body}${fields.length ? `\n\nForm field values:\n${fields.join('\n')}` : ''}`);
      page.cleanup();
    }

    const text = pages.join('\n\n').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    const wordCount = stripMarkers(text).split(/\s+/).filter(Boolean).length;
    return { text, pageCount, wordCount };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('PDF_UNREADABLE', undefined, { cause: err });
  } finally {
    await doc.destroy();
  }
}
