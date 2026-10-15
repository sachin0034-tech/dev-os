import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';

export default function ContractNotFound() {
  return (
    <PageContainer className="items-center justify-center">
      <h1 className="text-h5">We couldn&apos;t find that contract</h1>
      <p className="text-body-lg text-secondary">It may have been deleted, or the link is wrong.</p>
      <Link href="/dashboard" className={buttonVariants({ variant: 'secondary' })}>
        Back to dashboard
      </Link>
    </PageContainer>
  );
}
