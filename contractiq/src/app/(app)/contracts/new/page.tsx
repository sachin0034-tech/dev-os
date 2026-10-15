import { redirect } from 'next/navigation';
import { UploadWizard } from '@/components/contracts/upload-wizard';
import { PageContainer } from '@/components/layout/page-container';
import { getCurrentUser } from '@/lib/auth/get-user';
import { getContractDetail } from '@/lib/services/contracts.service';
import { getUsage } from '@/lib/services/usage.service';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Review a contract' };

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string }>;
}) {
  const { resume: resumeId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const usage = await getUsage(user.id);
  let resume;
  if (resumeId && /^[0-9a-f-]{36}$/i.test(resumeId)) {
    const detail = await getContractDetail(await createClient(), resumeId, { touch: false });
    if (!detail) redirect('/dashboard');
    if (detail.contract.status !== 'ready') redirect(`/contracts/${detail.contract.id}`);
    resume = { contract: detail.contract, customTerms: detail.customTerms };
  }

  return (
    <PageContainer>
      <UploadWizard initialUsage={usage} resume={resume} />
    </PageContainer>
  );
}
