import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="flex max-w-[760px] flex-col gap-6">
      <h1 className="text-h3 md:text-h1">Understand any NDA or MSA in minutes, not hours.</h1>
      <p className="text-body-lg text-secondary">
        Upload a contract and ContractIQ pulls out the terms that matter — with the page each one
        came from and how confident we are — then answers your questions using only what the
        document says.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {signedIn ? (
          <Link href="/dashboard" className={buttonVariants({ variant: 'primary' })}>
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link href="/signup" className={buttonVariants({ variant: 'primary' })}>
              Get Started Free
            </Link>
            <Link href="/login" className={buttonVariants({ variant: 'secondary' })}>
              Sign in
            </Link>
          </>
        )}
      </div>
      <p className="text-body-sm text-secondary">
        14-day free trial · 5 contract reviews · No card required
      </p>
    </section>
  );
}
