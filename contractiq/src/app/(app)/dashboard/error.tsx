'use client';

import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContainer className="items-start">
      <h1 className="text-h5">We couldn&apos;t load your contracts</h1>
      <p className="text-body-lg text-secondary">Please try again.</p>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </PageContainer>
  );
}
