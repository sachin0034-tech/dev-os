import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/layout/app-header';
import { getCurrentUser } from '@/lib/auth/get-user';

export const metadata = { robots: { index: false } };

// Second-layer guard behind middleware (docs/specs/auth.md §4).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <AppHeader email={user.email} />
      {children}
    </div>
  );
}
