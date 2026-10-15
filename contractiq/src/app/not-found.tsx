import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-h5">Page not found</h1>
      <p className="text-body-lg text-secondary">We couldn&apos;t find what you were looking for.</p>
      <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
        Back to home
      </Link>
    </main>
  );
}
