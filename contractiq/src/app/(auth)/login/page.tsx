import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to ContractIQ."
      footer={
        <>
          New to ContractIQ?{' '}
          <Link href="/signup" className="font-medium text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={sp.next} linkExpired={sp.error === 'link_expired'} />
    </AuthCard>
  );
}
