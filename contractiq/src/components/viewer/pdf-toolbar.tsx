'use client';

import { Download, FileText, FileType2, Maximize2, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useViewerStore, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '@/stores/viewer-store';

export function PdfToolbar({
  pageCount,
  downloadUrl,
  fileName,
  canShowPdf,
}: {
  pageCount: number;
  downloadUrl?: string;
  fileName: string;
  canShowPdf: boolean;
}) {
  const { mode, zoom, currentPage, setZoom, setMode, setTarget } = useViewerStore();
  const [pageInput, setPageInput] = useState(String(currentPage));
  useEffect(() => setPageInput(String(currentPage)), [currentPage]);

  const jump = () => {
    const n = Number(pageInput);
    if (Number.isInteger(n) && n >= 1 && n <= pageCount) setTarget(n, null);
    else setPageInput(String(currentPage));
  };

  return (
    <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-default bg-primary px-3">
      <div className="flex items-center gap-1">
        {mode === 'pdf' && (
          <>
            <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom(zoom - ZOOM_STEP)} disabled={zoom <= ZOOM_MIN}>
              <Minus className="h-4 w-4" aria-hidden />
            </Button>
            <span className="w-12 text-center text-body-sm text-secondary" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX}>
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
            <SimpleTooltip content="Fit width">
              <Button variant="ghost" size="icon" aria-label="Fit width" onClick={() => setZoom(1)}>
                <Maximize2 className="h-4 w-4" aria-hidden />
              </Button>
            </SimpleTooltip>
          </>
        )}
      </div>
      <label className="flex items-center gap-1 text-body-sm text-secondary">
        Page
        <input
          aria-label="Current page"
          inputMode="numeric"
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && jump()}
          onBlur={jump}
          className="h-8 w-10 rounded-md border border-default bg-primary text-center text-body-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        / {pageCount || '—'}
      </label>
      <div className="flex items-center gap-1">
        {canShowPdf && (
          <SimpleTooltip content={mode === 'pdf' ? 'View as text' : 'View PDF'}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={mode === 'pdf' ? 'View as text' : 'View PDF'}
              onClick={() => setMode(mode === 'pdf' ? 'text' : 'pdf', 'user')}
            >
              {mode === 'pdf' ? <FileText className="h-4 w-4" aria-hidden /> : <FileType2 className="h-4 w-4" aria-hidden />}
            </Button>
          </SimpleTooltip>
        )}
        {mode === 'pdf' && downloadUrl && (
          <SimpleTooltip content="Download PDF">
            <a
              href={downloadUrl}
              download={fileName}
              aria-label="Download PDF"
              className="flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-subtle"
            >
              <Download className="h-4 w-4" aria-hidden />
            </a>
          </SimpleTooltip>
        )}
      </div>
    </div>
  );
}
