import { logger } from '@/lib/utils/logger';

// Security audit trail — structured JSON lines (Vercel logs / log drain), tagged audit=true.
// Never include passwords, tokens, raw emails or contract content.
export type AuditEvent =
  | 'auth.login_succeeded'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.signup_requested'
  | 'auth.password_reset_requested'
  | 'auth.password_changed'
  | 'contract.deleted'
  | 'security.origin_rejected';

export function audit(event: AuditEvent, fields: Record<string, unknown> = {}) {
  const level = event === 'auth.login_failed' || event === 'security.origin_rejected' ? 'warn' : 'info';
  logger[level](event, { audit: true, ...fields });
}
