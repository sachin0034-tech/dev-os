'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-h5">Something went wrong</h1>
      <p className="text-body-lg text-secondary">Please try again.</p>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
