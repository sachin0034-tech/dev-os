'use client';

import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';

export default function ContractError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContainer className="items-center justify-center">
      <h1 className="text-h5">Something went wrong loading this contract</h1>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </PageContainer>
  );
}
