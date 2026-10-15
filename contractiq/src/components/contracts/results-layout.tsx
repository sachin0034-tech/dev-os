'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChatTab } from '@/components/chat/chat-tab';
import { KeyTermsPanel } from '@/components/key-terms/key-terms-panel';
import { OnboardingTour, RESULTS_TOUR } from '@/components/onboarding/onboarding-tour';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentPane } from '@/components/viewer/document-pane';
import { completeOnboarding } from '@/app/(app)/actions';
import { useContract } from '@/hooks/use-contract';
import { useProcessContract } from '@/hooks/use-process-contract';
import { ApiError } from '@/lib/api/client';
import { useResultsUiStore, type ResultsTab } from '@/stores/results-ui-store';
import { useViewerStore } from '@/stores/viewer-store';
import type { ContractDetailResponse } from '@/types/api';
import { ProcessingError } from './processing-error';
import { ProcessingProgress } from './processing-progress';
import { ResultsHeader } from './results-header';

const DESKTOP_QUERY = '(min-width: 1024px)';

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return desktop;
}

// Two-pane results screen (≥1024px) or tabbed (Document · Key Terms · Chat) — results spec §6.
export function ResultsLayout({
  initialData,
  showOnboarding,
}: {
  initialData: ContractDetailResponse;
  showOnboarding: boolean;
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const query = useContract(initialData.contract.id, initialData);
  const process = useProcessContract(initialData.contract.id);
  // Individual selectors: stable references for effect dependencies (no re-render loops).
  const activeTab = useResultsUiStore((s) => s.activeTab);
  const setActiveTab = useResultsUiStore((s) => s.setActiveTab);
  const resetUi = useResultsUiStore((s) => s.reset);
  const setTarget = useViewerStore((s) => s.setTarget);
  const userHasNavigated = useViewerStore((s) => s.userHasNavigated);
  const resetViewer = useViewerStore((s) => s.reset);
  const [tourOpen, setTourOpen] = useState(showOnboarding);
  const autoNavigated = useRef(false);

  const data = query.data ?? initialData;
  const { contract } = data;

  useEffect(() => () => {
    resetUi();
    resetViewer();
  }, [resetUi, resetViewer]);

  // Contract deleted in another tab → back to dashboard.
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 404) {
      toast.error('This contract was deleted');
      router.replace('/dashboard');
    }
  }, [query.error, router]);

  // First visit: jump to the first low-confidence term so the user can verify it.
  useEffect(() => {
    if (autoNavigated.current || userHasNavigated || contract.status !== 'completed') return;
    const firstLow = data.keyTerms.find((t) => t.confidenceScore < 50 && t.value !== null && t.pageNumber !== null);
    autoNavigated.current = true;
    if (firstLow?.pageNumber) setTarget(firstLow.pageNumber, firstLow.sourceSentence, { auto: true });
  }, [contract.status, data.keyTerms, setTarget, userHasNavigated]);

  const navigate = (page: number, text: string | null) => {
    setTarget(page, text);
    if (!isDesktop) setActiveTab('document');
  };

  const finishTour = () => {
    setTourOpen(false);
    void completeOnboarding();
  };

  const termsContent =
    contract.status === 'processing' ? (
      <ProcessingProgress activeStep={2} />
    ) : contract.status === 'error' ? (
      <ProcessingError
        message={contract.errorMessage ?? "We couldn't analyse this contract. Try again in a few minutes."}
        retrying={process.isPending}
        onRetry={() =>
          process.mutate(undefined, {
            onError: (err) => toast.error(err.message),
          })
        }
      />
    ) : (
      <KeyTermsPanel data={data} onNavigate={navigate} />
    );

  const chat = (
    <ChatTab
      contractId={contract.id}
      contractType={contract.contractType}
      pageCount={contract.pageCount ?? 1}
      ready={contract.status === 'completed'}
      onCitationClick={(page) => navigate(page, null)}
    />
  );

  const tab = isDesktop && activeTab === 'document' ? 'terms' : activeTab;

  return (
    <div className="flex h-[calc(100dvh-64px)] min-h-0 flex-col">
      <ResultsHeader contract={contract} />
      <div className="flex min-h-0 flex-1">
        {isDesktop && (
          <section aria-label="Contract document" className="min-h-0 w-1/2 border-r border-default xl:w-[55%]">
            <DocumentPane contract={contract} />
          </section>
        )}
        <Tabs
          value={tab}
          onValueChange={(v) => setActiveTab(v as ResultsTab)}
          className="flex min-h-0 flex-1 flex-col bg-surface"
        >
          <TabsList className="shrink-0 bg-primary px-4">
            {!isDesktop && <TabsTrigger value="document">Document</TabsTrigger>}
            <TabsTrigger value="terms">Key Terms</TabsTrigger>
            <TabsTrigger value="chat" data-tour="chat-tab">
              Chat
            </TabsTrigger>
          </TabsList>
          {!isDesktop && (
            <TabsContent value="document" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
              <DocumentPane contract={contract} />
            </TabsContent>
          )}
          <TabsContent value="terms" className="min-h-0 flex-1 overflow-y-auto p-4">
            {termsContent}
          </TabsContent>
          <TabsContent value="chat" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
            {chat}
          </TabsContent>
        </Tabs>
      </div>
      {tourOpen && contract.status === 'completed' && <OnboardingTour steps={RESULTS_TOUR} onDone={finishTour} />}
    </div>
  );
}
