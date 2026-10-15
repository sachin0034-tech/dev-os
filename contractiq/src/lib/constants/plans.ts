import type { Plan } from '@/types/api';

// Plan limits — docs/specs/usage-quota-and-rate-limits.md §3
export const PLANS: Record<Plan, { label: string; analyses: number | null; period: 'trial' | 'month' }> = {
  trial: { label: 'Free trial', analyses: 5, period: 'trial' },
  starter: { label: 'Starter', analyses: 10, period: 'month' },
  growth: { label: 'Growth', analyses: 40, period: 'month' },
  pro: { label: 'Pro', analyses: null, period: 'month' },
};

export const isPlan = (value: string): value is Plan => value in PLANS;
