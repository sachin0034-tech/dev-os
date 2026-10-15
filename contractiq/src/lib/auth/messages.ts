export const AUTH_MESSAGES = {
  EMAIL_TAKEN: 'An account with this email already exists. Sign in instead.',
  WEAK_PASSWORD: 'Use at least 8 characters with a letter and a number.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  EMAIL_NOT_CONFIRMED: 'Please verify your email first. We can resend the link.',
  RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
  VALIDATION_ERROR: 'Please check the highlighted fields.',
  INTERNAL: 'Something went wrong. Please try again.',
} as const;

export type AuthErrorCode = keyof typeof AUTH_MESSAGES;

export type AuthActionState =
  | { ok: true; message?: string }
  | { ok: false; code: AuthErrorCode; message: string; fieldErrors?: Record<string, string[]> }
  | null;
