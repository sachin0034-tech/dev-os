import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { getCurrentUser } from '@/lib/auth/get-user';

export const metadata = { title: 'Choose a new password' };

// Reached from the password-reset email via /auth/callback?next=/reset-password,
// which has already exchanged the recovery code for a session.
export default async function ResetPasswordPage() {
  if (!(await getCurrentUser())) redirect('/login?error=link_expired');
  return (
    <AuthCard title="Choose a new password" subtitle="Other signed-in sessions will be signed out.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
