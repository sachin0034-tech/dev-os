'use client';

import { useUsage } from '@/hooks/use-usage';
import { PLANS } from '@/lib/constants/plans';
import { cn } from '@/lib/utils/cn';
import type { Usage } from '@/types/api';

const DAY_MS = 86_400_000;

export function UsageMeter({ initial }: { initial: Usage }) {
  const { data: usage = initial } = useUsage(initial);
  const limit = usage.analysesLimit;

  if (limit === null) {
    return (
      <div className="rounded-lg border border-default bg-primary p-4 text-body-lg">
        {PLANS[usage.plan].label} plan · Unlimited analyses
      </div>
    );
  }

  const ratio = Math.min(1, usage.analysesUsed / limit);
  const daysLeft = Math.max(0, Math.ceil((new Date(usage.periodEnd).getTime() - Date.now()) / DAY_MS));
  const label =
    usage.plan === 'trial'
      ? `${usage.analysesUsed} of ${limit} trial analyses used · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
      : `${usage.analysesUsed} of ${limit} analyses used this month`;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-default bg-primary p-4">
      <span className="text-body-sm text-secondary">{label}</span>
      <div
        className="h-2 overflow-hidden rounded-sm bg-subtle"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={usage.analysesUsed}
        aria-label="Analyses used"
      >
        <div
          className={cn('h-full rounded-sm', ratio >= 1 ? 'bg-danger' : ratio >= 0.8 ? 'bg-warning' : 'bg-brand')}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
