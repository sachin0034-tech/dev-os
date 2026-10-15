import Link from 'next/link';

export const metadata = { robots: { index: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface px-4 py-12">
      <Link href="/" className="text-h5">
        ContractIQ
      </Link>
      {children}
    </main>
  );
}
