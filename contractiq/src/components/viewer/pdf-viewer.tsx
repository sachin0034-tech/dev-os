'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import { Skeleton } from '@/components/ui/skeleton';
import { itemInNeedle, normalizeForHighlight } from '@/lib/viewer/highlight';
import { useViewerStore } from '@/stores/viewer-store';
import { usePageNavigation } from './use-page-navigation';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const DEFAULT_ASPECT = 1.294; // US Letter height/width
const MOUNT_WINDOW = 2; // pages rendered either side of the visible/target page

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// PDF.js viewer with lazy page mounting (contract-viewer.md §6).
export function PdfViewer({ url, onFailed }: { url: string; onFailed: () => void }) {
  const { zoom, currentPage, targetPage, setPageCount } = useViewerStore();
  const [numPages, setNumPages] = useState(0);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLElement | null)[]>([]);
  const highlight = usePageNavigation(slotRefs, numPages > 0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, (entry?.contentRect.width ?? 0) - 32)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWidth = Math.round(width * zoom);
  const file = useMemo(() => ({ url }), [url]);

  const shouldMount = (n: number) =>
    Math.abs(n - currentPage) <= MOUNT_WINDOW || (targetPage !== null && Math.abs(n - targetPage) <= MOUNT_WINDOW);

  const needle = highlight ? normalizeForHighlight(highlight.text) : null;
  const textRenderer = useCallback(
    ({ str, pageNumber }: { str: string; pageNumber: number }) =>
      needle && highlight?.page === pageNumber && itemInNeedle(str, needle)
        ? `<mark class="ci-highlight">${escapeHtml(str)}</mark>`
        : escapeHtml(str),
    [needle, highlight?.page],
  );

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4 p-4">
      <Document
        file={file}
        loading={<PageSkeletons />}
        error={<PageSkeletons />}
        onLoadSuccess={async (doc) => {
          setNumPages(doc.numPages);
          setPageCount(doc.numPages);
          try {
            const first = await doc.getPage(1);
            const vp = first.getViewport({ scale: 1 });
            setAspect(vp.height / vp.width);
          } catch {
            // keep default aspect
          }
        }}
        onLoadError={onFailed}
        onSourceError={onFailed}
        className="flex flex-col items-center gap-4"
      >
        {pageWidth > 0 &&
          Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
            <div
              key={n}
              data-page={n}
              ref={(el) => {
                slotRefs.current[n - 1] = el;
              }}
              aria-label={`Page ${n}`}
              role="region"
              className="border border-default bg-primary"
              style={{ width: pageWidth, minHeight: Math.round(pageWidth * aspect) }}
            >
              {shouldMount(n) ? (
                <Page
                  pageNumber={n}
                  width={pageWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer
                  customTextRenderer={textRenderer}
                  loading={<Skeleton className="h-full w-full" style={{ height: Math.round(pageWidth * aspect) }} />}
                />
              ) : null}
            </div>
          ))}
      </Document>
    </div>
  );
}

function PageSkeletons() {
  return (
    <div className="flex w-full flex-col gap-4">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-[480px] w-full" />
      ))}
    </div>
  );
}
