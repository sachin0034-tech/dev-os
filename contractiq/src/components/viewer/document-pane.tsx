'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useContractText } from '@/hooks/use-contract-text';
import { usePdfUrl } from '@/hooks/use-pdf-url';
import { useViewerStore } from '@/stores/viewer-store';
import type { ContractDetail } from '@/types/api';
import { ContractTextViewer } from './contract-text-viewer';
import { PdfToolbar } from './pdf-toolbar';
import { ViewerFallbackBanner } from './viewer-fallback-banner';

const PdfViewer = dynamic(() => import('./pdf-viewer').then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <Skeleton className="m-4 h-[480px]" />,
});

// Chooses PDF vs text mode — contract-viewer.md §5.
export function DocumentPane({ contract }: { contract: ContractDetail }) {
  const { mode, fallbackReason, setMode, setPageCount } = useViewerStore();
  const pdfUrl = usePdfUrl(contract.id, contract.hasPdf);
  const retriedUrl = useRef(false);

  useEffect(() => {
    if (!contract.hasPdf) setMode('text', contract.pdfDeletedAt ? 'retention' : 'not_stored');
    else setMode('pdf');
    setPageCount(contract.pageCount ?? 0);
  }, [contract.hasPdf, contract.pdfDeletedAt, contract.pageCount, setMode, setPageCount]);

  useEffect(() => {
    if (pdfUrl.isError) {
      const code = (pdfUrl.error as { code?: string }).code;
      setMode('text', code === 'PDF_UNAVAILABLE' ? 'retention' : 'unavailable');
    }
  }, [pdfUrl.isError, pdfUrl.error, setMode]);

  const text = useContractText(contract.id, mode === 'text');

  const onPdfFailed = () => {
    // A failed load may be an expired signed URL: refetch once, then fall back to text.
    if (!retriedUrl.current) {
      retriedUrl.current = true;
      void pdfUrl.refetch();
      return;
    }
    setMode('text', 'render_failed');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-subtle">
      <PdfToolbar
        pageCount={contract.pageCount ?? 0}
        downloadUrl={pdfUrl.data?.url}
        fileName={contract.fileName}
        canShowPdf={contract.hasPdf && !pdfUrl.isError}
      />
      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="document-scroll">
        {mode === 'text' && fallbackReason && <ViewerFallbackBanner reason={fallbackReason} />}
        {mode === 'pdf' && pdfUrl.data ? (
          <PdfViewer key={pdfUrl.data.url} url={pdfUrl.data.url} onFailed={onPdfFailed} />
        ) : mode === 'pdf' ? (
          <Skeleton className="m-4 h-[480px]" />
        ) : (
          <ContractTextViewer text={text.data} loading={text.isLoading} />
        )}
      </div>
    </div>
  );
}
