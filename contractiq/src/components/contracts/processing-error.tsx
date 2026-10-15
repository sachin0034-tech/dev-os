'use client';

import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';

export function ProcessingError({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <section role="alert" className="flex flex-col gap-4 rounded-lg border border-danger-border bg-danger-tint p-6">
      <h2 className="text-h5 text-danger-text">We couldn&apos;t finish the analysis</h2>
      <p className="text-body-lg text-primary">{message}</p>
      <p className="text-body-sm text-secondary">
        Your upload is saved — trying again won&apos;t count against your trial if it fails.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRetry} loading={retrying}>
          Try again
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: 'secondary' })}>
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
