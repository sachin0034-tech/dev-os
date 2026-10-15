import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata = { title: 'Create your account' };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="14-day free trial · 5 contract reviews · No card required"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
