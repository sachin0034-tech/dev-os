import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export function LandingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-default bg-primary px-4 md:px-12 xl:px-28">
      <Link href="/" className="text-h5">
        ContractIQ
      </Link>
      <nav className="flex items-center gap-2" aria-label="Main">
        {signedIn ? (
          <Link href="/dashboard" className={buttonVariants({ variant: 'primary' })}>
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link href="/login" className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex')}>
              Sign in
            </Link>
            <Link href="/signup" className={buttonVariants({ variant: 'primary' })}>
              Get Started Free
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
