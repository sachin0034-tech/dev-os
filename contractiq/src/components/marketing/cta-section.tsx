import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export function CtaSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="flex flex-col items-start gap-6 rounded-lg border border-default bg-primary p-8 md:flex-row md:items-center md:justify-between">
      <h2 className="text-h5">Stop signing contracts you haven&apos;t fully read.</h2>
      <Link href={signedIn ? '/contracts/new' : '/signup'} className={buttonVariants({ variant: 'primary' })}>
        {signedIn ? 'Review a Contract' : 'Get Started Free'}
      </Link>
    </section>
  );
}
