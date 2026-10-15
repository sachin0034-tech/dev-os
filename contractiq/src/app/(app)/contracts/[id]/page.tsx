import { notFound, redirect } from 'next/navigation';
import { ResultsLayout } from '@/components/contracts/results-layout';
import { getCurrentProfile } from '@/lib/auth/get-user';
import { getContractDetail } from '@/lib/services/contracts.service';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Contract results' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ContractResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const detail = await getContractDetail(await createClient(), id);
  if (!detail) notFound();
  if (detail.contract.status === 'ready') redirect(`/contracts/new?resume=${id}`);

  const profile = await getCurrentProfile();
  return <ResultsLayout initialData={detail} showOnboarding={!profile?.onboarding_completed_at} />;
}
