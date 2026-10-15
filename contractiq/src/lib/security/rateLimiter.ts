import 'server-only';
import { createHash } from 'node:crypto';
import { AppError } from '@/lib/api/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

// Sliding-window rate limiting backed by Supabase (rate_limit_events + rate_limit_hit RPC).
// All reads/writes go through the service-role client so users cannot touch their counters.
// docs/security/security-plan.md §3

export const RATE_LIMITS = {
  auth: { limit: 10, windowSec: 60, failOpen: false }, // sign-in, sign-up, resend, password reset
  chat: { limit: 30, windowSec: 60, failOpen: true },
  chat_daily: { limit: 300, windowSec: 86_400, failOpen: true },
  process: { limit: 5, windowSec: 3_600, failOpen: false },
  upload: { limit: 20, windowSec: 86_400, failOpen: false },
  key_term_edit: { limit: 120, windowSec: 60, failOpen: true },
  feedback: { limit: 30, windowSec: 3_600, failOpen: true },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 40);

/** Subject keys: never store raw IPs or emails. */
export const subjectFor = {
  user: (userId: string) => `user:${userId}`,
  ip: (ip: string) => `ip:${hash(ip)}`,
  email: (email: string) => `email:${hash(email.trim().toLowerCase())}`,
};

/** Client IP from proxy headers (Vercel sets x-forwarded-for); "unknown" when absent. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Records one hit for `subject` + `action`; throws RATE_LIMITED (429 + Retry-After) when the
 * sliding window is full. Fails closed for cost-bearing/auth actions if the store is unavailable.
 */
export async function enforceRateLimit(
  action: RateLimitAction,
  subject: string,
  userId: string | null = null,
): Promise<void> {
  const { limit, windowSec, failOpen } = RATE_LIMITS[action];
  const { data, error } = await createAdminClient().rpc('rate_limit_hit', {
    p_subject: subject,
    p_user_id: userId as string,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSec,
  });

  if (error) {
    logger.error('rate_limit.error', { action, code: error.code });
    if (failOpen) return;
    throw new AppError('INTERNAL', undefined, { cause: error });
  }
  if (typeof data === 'number' && data > 0) {
    logger.warn('rate_limit.blocked', { action, subject: subject.split(':')[0], userId });
    throw new AppError('RATE_LIMITED', { retryAfterSeconds: data });
  }
}

/** Convenience for signed-in actions. */
export const enforceUserRateLimit = (action: RateLimitAction, userId: string) =>
  enforceRateLimit(action, subjectFor.user(userId), userId);
