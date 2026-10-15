import { AppError } from '@/lib/api/errors';
import { withHandler } from '@/lib/api/handler';
import { audit } from '@/lib/security/auditLog';
import { assertSameOrigin } from '@/lib/security/authGuard';
import { enforceRateLimit, getClientIp, subjectFor } from '@/lib/security/rateLimiter';
import { safeNext, signInSchema } from '@/lib/validation/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server-side sign-in: cookies are set by the server Supabase client (docs/security/security-plan.md §1).
export const POST = withHandler({ auth: false, body: signInSchema }, async ({ req, body, supabase }) => {
  try {
    assertSameOrigin(req);
  } catch (err) {
    audit('security.origin_rejected', { route: 'auth.login' });
    throw err;
  }

  // Per-IP and per-account limits (10/min each) slow down credential stuffing and brute force.
  await enforceRateLimit('auth', subjectFor.ip(getClientIp(req.headers)));
  await enforceRateLimit('auth', subjectFor.email(body.email));

  const { data, error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
  if (error) {
    audit('auth.login_failed', { reason: error.code ?? String(error.status) });
    if (error.code === 'email_not_confirmed') throw new AppError('EMAIL_NOT_CONFIRMED');
    if (error.status === 429 || error.code?.startsWith('over_')) throw new AppError('RATE_LIMITED', { retryAfterSeconds: 60 });
    if (error.code === 'invalid_credentials' || error.status === 400) throw new AppError('INVALID_CREDENTIALS');
    throw new AppError('INTERNAL', undefined, { cause: error });
  }

  audit('auth.login_succeeded', { userId: data.user.id });
  return { redirectTo: safeNext(body.next) };
});
