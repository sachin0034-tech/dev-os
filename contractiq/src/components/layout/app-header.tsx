'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { UserMenu } from './user-menu';

export function AppHeader({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-default bg-primary px-4 md:px-6">
      <Link href="/dashboard" className="text-h5">
        ContractIQ
      </Link>
      <div className="flex items-center gap-2">
        {pathname !== '/contracts/new' && (
          <Link href="/contracts/new" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
            Review a Contract
          </Link>
        )}
        <UserMenu email={email} />
      </div>
    </header>
  );
}
