'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useProcessContract } from '@/hooks/use-process-contract';
import { useUsage } from '@/hooks/use-usage';
import { useUploadStore } from '@/stores/upload-store';
import type { ContractDetail, CustomTerm, Usage } from '@/types/api';
import { ContractTypeSelect } from './contract-type-select';
import { KeyTermPreview } from './key-term-preview';
import { PdfDropzone } from './pdf-dropzone';
import { ProcessingError } from './processing-error';
import { ProcessingProgress } from './processing-progress';
import { QuotaExceededCard } from './quota-exceeded-card';
import { UploadedFileSummary } from './uploaded-file-summary';
import { UploadProgress } from './upload-progress';

export function UploadWizard({
  initialUsage,
  resume,
}: {
  initialUsage: Usage;
  resume?: { contract: ContractDetail; customTerms: CustomTerm[] };
}) {
  const router = useRouter();
  const store = useUploadStore();
  const { data: usage } = useUsage(initialUsage);
  const process = useProcessContract(store.contractId);
  const [processStartedAt, setProcessStartedAt] = useState<number>();
  const [compiling, setCompiling] = useState(false);

  // Fresh wizard on mount; hydrate when resuming a `ready` contract.
  useEffect(() => {
    if (resume) store.resume(resume.contract, resume.customTerms);
    else store.reset();
    return () => store.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = store.step === 'uploading' || store.step === 'extracting';
  const locked = store.step === 'processing' || compiling;
  const pendingTerms = store.drafts.some((d) => !d.pendingRemoval && d.status !== 'saved');
  const canProcess = store.step === 'preview' && !!store.contract && !pendingTerms && !process.isPending;

  const runProcess = () => {
    if (!store.contractId) return;
    store.setStep('processing');
    setProcessStartedAt(Date.now());
    process.mutate(undefined, {
      onSuccess: (res) => {
        setCompiling(true);
        setTimeout(() => router.replace(`/contracts/${res.contractId}`), 400);
      },
      onError: (err) => {
        if (err.code === 'ALREADY_PROCESSING') {
          router.replace(`/contracts/${store.contractId}`);
          return;
        }
        // Back to preview: ProcessingError (or QuotaExceededCard) renders from process.error.
        store.setStep('preview');
        if (err.code === 'RATE_LIMITED') toast.error(err.message);
      },
    });
  };

  if (usage && !usage.canAnalyse && !resume && store.step === 'select') {
    return <QuotaExceededCard reason={usage.reason} />;
  }
  if (process.error?.code === 'QUOTA_EXCEEDED') {
    return <QuotaExceededCard reason={(process.error.reason as Usage['reason']) ?? usage?.reason ?? null} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-h5">Review a contract</h1>
          <p className="text-body-sm text-secondary">
            Choose the contract type, upload the PDF, then add any extra terms you care about.
          </p>
        </header>

        <ContractTypeSelect
          value={store.contractType}
          onChange={store.setContractType}
          disabled={store.step !== 'select' && store.step !== 'error'}
        />

        {(store.step === 'select' || store.step === 'error') && (
          <>
            {store.error && <Alert tone="danger">{store.error.message}</Alert>}
            <PdfDropzone
              disabled={!store.contractType}
              disabledHint="Choose a contract type first"
              onFile={(file) => void store.startUpload(file)}
            />
          </>
        )}

        {busy && store.fileName && (
          <UploadProgress fileName={store.fileName} phase={store.step === 'uploading' ? 'uploading' : 'extracting'} />
        )}

        {store.contract && !busy && <UploadedFileSummary contract={store.contract} />}

        {store.step === 'preview' && process.error && process.error.code !== 'QUOTA_EXCEEDED' && (
          <ProcessingError
            message={process.error.detail ? `${process.error.message} (${process.error.detail})` : process.error.message}
            onRetry={runProcess}
            retrying={process.isPending}
          />
        )}

        {store.step === 'processing' || compiling ? (
          <ProcessingProgress activeStep={compiling ? 3 : 2} startedAt={processStartedAt} />
        ) : (
          store.step === 'preview' &&
          !process.error && (
            <SimpleTooltip
              content={pendingTerms ? 'Saving custom terms…' : 'Run the AI analysis on this contract'}
            >
              <span className="w-full">
                <Button className="w-full" onClick={runProcess} disabled={!canProcess}>
                  Process Contract
                </Button>
              </span>
            </SimpleTooltip>
          )
        )}

        <p className="hidden text-body-sm text-secondary max-sm:block">
          Large PDFs work best on desktop.
        </p>
      </div>

      {store.contractType && (
        <KeyTermPreview
          contractType={store.contractType}
          drafts={store.drafts}
          locked={locked}
          onAdd={store.addTerm}
          onRemove={(tempId) =>
            void store.removeTerm(tempId).catch(() => toast.error("Couldn't remove that term. Try again."))
          }
          onRetry={store.retryTerm}
        />
      )}
    </div>
  );
}
