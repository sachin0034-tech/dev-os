'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppError } from '@/lib/api/errors';
import { getCurrentUser } from '@/lib/auth/get-user';
import { AUTH_MESSAGES, type AuthActionState, type AuthErrorCode } from '@/lib/auth/messages';
import { audit } from '@/lib/security/auditLog';
import { enforceRateLimit, getClientIp, subjectFor } from '@/lib/security/rateLimiter';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { forgotPasswordSchema, resendSchema, resetPasswordSchema, signUpSchema } from '@/lib/validation/auth';

// Sign-in and sign-out live in /api/auth/login and /api/auth/logout.
// These actions cover sign-up, verification resend and password reset.

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? '';
const callbackUrl = (next?: string) =>
  `${appUrl()}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;

const fail = (code: AuthErrorCode, fieldErrors?: Record<string, string[]>): AuthActionState => ({
  ok: false,
  code,
  message: AUTH_MESSAGES[code],
  fieldErrors,
});

const isRateLimit = (code?: string, status?: number) => status === 429 || (code?.startsWith('over_') ?? false);

/** 10 requests / minute per IP (and per email when given). Returns a failure state when limited. */
async function limitAuth(email?: string): Promise<AuthActionState | null> {
  try {
    await enforceRateLimit('auth', subjectFor.ip(getClientIp(await headers())));
    if (email) await enforceRateLimit('auth', subjectFor.email(email));
    return null;
  } catch (err) {
    if (err instanceof AppError && err.code === 'RATE_LIMITED') return fail('RATE_LIMITED');
    // Limiter unavailable (e.g. migration not applied, env misconfigured): fail closed with a
    // friendly message instead of crashing the page.
    logger.error('auth.rate_limit_unavailable', { err });
    return fail('INTERNAL');
  }
}

export async function signUp(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors);

  const limited = await limitAuth(parsed.data.email);
  if (limited) return limited;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: callbackUrl() },
  });

  if (error) {
    if (error.code === 'user_already_exists' || error.code === 'email_exists') return fail('EMAIL_TAKEN');
    if (error.code === 'weak_password') return fail('WEAK_PASSWORD');
    if (isRateLimit(error.code, error.status)) return fail('RATE_LIMITED');
    logger.error('auth.signup_failed', { code: error.code, status: error.status });
    return fail('INTERNAL');
  }

  // With email confirmation on, an already-confirmed address returns a user with no identities.
  if (data.user && data.user.identities?.length === 0) return fail('EMAIL_TAKEN');

  audit('auth.signup_requested', { userId: data.user?.id });
  redirect(`/signup/check-email?email=${encodeURIComponent(parsed.data.email)}`);
}

// Always reports success so the form can't be used to discover which emails have accounts.
export async function resendVerification(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = resendSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors);

  const limited = await limitAuth(parsed.data.email);
  if (limited) return limited;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error && isRateLimit(error.code, error.status)) return fail('RATE_LIMITED');
  if (error) logger.warn('auth.resend_failed', { code: error.code, status: error.status });
  return { ok: true, message: 'If an account needs verifying, a new link is on its way.' };
}

// Same response whether or not the account exists (no account enumeration).
export async function requestPasswordReset(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors);

  const limited = await limitAuth(parsed.data.email);
  if (limited) return limited;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl('/reset-password'),
  });
  if (error && isRateLimit(error.code, error.status)) return fail('RATE_LIMITED');
  if (error) logger.warn('auth.password_reset_failed', { code: error.code, status: error.status });
  audit('auth.password_reset_requested');
  return { ok: true, message: 'If an account exists for that email, a reset link is on its way.' };
}

export async function updatePassword(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?error=link_expired');

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors);

  const limited = await limitAuth();
  if (limited) return limited;

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === 'weak_password' || error.code === 'same_password') return fail('WEAK_PASSWORD');
    logger.error('auth.password_update_failed', { code: error.code, status: error.status });
    return fail('INTERNAL');
  }
  // End every other session that might belong to whoever knew the old password.
  await supabase.auth.signOut({ scope: 'others' });
  audit('auth.password_changed', { userId: user.id });
  redirect('/dashboard');
}
