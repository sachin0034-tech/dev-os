import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { ResendVerification } from '@/components/auth/resend-verification';

export const metadata = { title: 'Check your inbox' };

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const email = ((await searchParams).email ?? '').slice(0, 254);
  return (
    <AuthCard
      title="Check your inbox"
      footer={
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="flex items-start gap-3">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
        <p className="text-body-lg text-secondary">
          {email ? (
            <>
              We sent a verification link to <span className="text-primary">{email}</span>.
            </>
          ) : (
            'We sent you a verification link.'
          )}{' '}
          Click it to activate your account.
        </p>
      </div>
      {email && <ResendVerification email={email} />}
    </AuthCard>
  );
}
