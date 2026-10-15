// Copies the PDF.js worker that matches the installed react-pdf version into /public
// so the browser can load it same-origin (see docs/specs/contract-viewer.md §6).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

try {
  // Resolve pdfjs-dist relative to react-pdf so versions always match.
  const reactPdfDir = dirname(require.resolve('react-pdf/package.json'));
  const pdfjsDir = dirname(require.resolve('pdfjs-dist/package.json', { paths: [reactPdfDir] }));
  const src = join(pdfjsDir, 'build', 'pdf.worker.min.mjs');
  if (!existsSync(src)) {
    console.warn('[copy-pdf-worker] worker not found, skipping:', src);
    process.exit(0);
  }
  mkdirSync('public', { recursive: true });
  copyFileSync(src, join('public', 'pdf.worker.min.mjs'));
  console.log('[copy-pdf-worker] copied pdf.worker.min.mjs to public/');
} catch (err) {
  console.warn('[copy-pdf-worker] skipped:', err instanceof Error ? err.message : err);
}
