import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ContractsTable } from '@/components/dashboard/contracts-table';
import { UsageMeter } from '@/components/dashboard/usage-meter';
import { PageContainer } from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth/get-user';
import { listContracts } from '@/lib/services/contracts.service';
import { getUsage } from '@/lib/services/usage.service';
import { createClient } from '@/lib/supabase/server';
import { listContractsQuerySchema } from '@/lib/validation/contracts';

export const metadata = { title: 'Your contracts' };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const query = listContractsQuerySchema.parse(await searchParams);
  const [list, usage] = await Promise.all([listContracts(await createClient(), query), getUsage(user.id)]);

  return (
    <PageContainer>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h5">Your contracts</h1>
          <p className="text-body-sm text-secondary">Review NDAs and MSAs in minutes.</p>
        </div>
        {usage.canAnalyse && (
          <Link href="/contracts/new" className={buttonVariants({ variant: 'primary' })}>
            Review a Contract
          </Link>
        )}
      </header>
      <UsageMeter initial={usage} />
      <ContractsTable initialQuery={query} initialData={list} />
    </PageContainer>
  );
}
