import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export function EmptyState() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-default bg-primary p-8">
      <h2 className="text-h5">No contracts reviewed yet</h2>
      <p className="text-body-lg text-secondary">Upload your first contract to begin.</p>
      <Link href="/contracts/new" className={buttonVariants({ variant: 'primary' })}>
        Review a Contract
      </Link>
    </section>
  );
}
