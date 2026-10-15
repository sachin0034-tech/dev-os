import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { clientEnv } from '@/lib/env.client';
import type { QuotaReason } from '@/types/api';

const TITLES: Record<QuotaReason, string> = {
  TRIAL_EXHAUSTED: "You've used your free trial",
  TRIAL_EXPIRED: 'Your free trial has ended',
  PLAN_LIMIT: "You've reached this month's limit",
};

export function QuotaExceededCard({ reason }: { reason: QuotaReason | null }) {
  const mailto = `mailto:${clientEnv.supportEmail}?subject=${encodeURIComponent('ContractIQ waitlist')}`;
  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-default bg-primary">
      <div className="bg-warning-tint px-6 py-3 text-body-sm font-medium text-warning-text">
        Analysis limit reached
      </div>
      <div className="flex flex-col gap-4 p-6">
        <h2 className="text-h5">{TITLES[reason ?? 'TRIAL_EXHAUSTED']}</h2>
        <p className="text-body-lg text-secondary">
          Paid plans are coming soon. Join the waitlist and we&apos;ll let you know. Your existing
          contracts and chats remain fully available.
        </p>
        <div className="flex flex-wrap gap-2">
          {clientEnv.supportEmail && (
            <a href={mailto} className={buttonVariants({ variant: 'primary' })}>
              Join the waitlist
            </a>
          )}
          <Link href="/dashboard" className={buttonVariants({ variant: 'secondary' })}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
