import 'server-only';
import { calcCostUsd } from '@/lib/ai/cost';
import { AppError } from '@/lib/api/errors';
import { isPlan, PLANS } from '@/lib/constants/plans';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import type { QuotaReason, Usage } from '@/types/api';

const startOfUtcMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const startOfNextUtcMonth = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

// Quota state for the user's plan — docs/specs/usage-quota-and-rate-limits.md §4
export async function getUsage(userId: string): Promise<Usage> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('plan, trial_ends_at, created_at')
    .eq('id', userId)
    .single();
  if (error || !profile) throw new AppError('INTERNAL', undefined, { cause: error });

  const plan = isPlan(profile.plan) ? profile.plan : 'trial';
  const cfg = PLANS[plan];
  const now = new Date();
  const [start, end] =
    cfg.period === 'trial'
      ? [new Date(profile.created_at), new Date(profile.trial_ends_at)]
      : [startOfUtcMonth(now), startOfNextUtcMonth(now)];

  const { count, error: countError } = await admin
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', 'extraction')
    .eq('success', true)
    .gte('created_at', start.toISOString())
    .lt('created_at', cfg.period === 'trial' ? now.toISOString() : end.toISOString());
  if (countError) throw new AppError('INTERNAL', undefined, { cause: countError });

  const used = count ?? 0;
  let reason: QuotaReason | null = null;
  if (cfg.period === 'trial' && now >= new Date(profile.trial_ends_at)) reason = 'TRIAL_EXPIRED';
  else if (cfg.analyses !== null && used >= cfg.analyses) {
    reason = cfg.period === 'trial' ? 'TRIAL_EXHAUSTED' : 'PLAN_LIMIT';
  }

  return {
    plan,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    analysesUsed: used,
    analysesLimit: cfg.analyses,
    canAnalyse: reason === null,
    reason,
  };
}

export async function assertQuota(userId: string): Promise<void> {
  const usage = await getUsage(userId);
  if (!usage.canAnalyse) {
    logger.warn('quota.blocked', { userId, reason: usage.reason });
    throw new AppError('QUOTA_EXCEEDED', { reason: usage.reason ?? undefined });
  }
}

export interface UsageEventInput {
  userId: string;
  contractId: string | null;
  eventType: 'extraction' | 'chat';
  model: string;
  promptVersion: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
}

// Records tokens, cost and latency. Never throws — usage logging must not break a request.
export async function logUsage(e: UsageEventInput): Promise<void> {
  const { error } = await createAdminClient()
    .from('usage_events')
    .insert({
      user_id: e.userId,
      contract_id: e.contractId,
      event_type: e.eventType,
      model: e.model,
      prompt_version: e.promptVersion,
      prompt_tokens: e.promptTokens,
      completion_tokens: e.completionTokens,
      cost_usd: calcCostUsd(e.promptTokens, e.completionTokens),
      latency_ms: e.latencyMs,
      success: e.success,
      error_code: e.errorCode ?? null,
    });
  if (error) logger.error('usage.log_failed', { userId: e.userId, code: error.code });
}
