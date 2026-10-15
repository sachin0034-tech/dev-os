import { z } from 'zod';

// docs/specs/auth.md §3
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email')
  .email('Enter a valid email')
  .max(254);

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 && p.length <= 72 },
  { id: 'letter', label: 'Includes a letter', test: (p: string) => /[A-Za-z]/.test(p) },
  { id: 'number', label: 'Includes a number', test: (p: string) => /\d/.test(p) },
] as const;

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a number');

export const signUpSchema = z.object({ email: emailSchema, password: passwordSchema });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
  next: z.string().optional(),
});

export const resendSchema = z.object({ email: emailSchema });

// Only same-site relative paths. Parsing with a dummy origin catches tricks like
// "//evil.com", "/\\evil.com" and "/\t/evil.com" (browsers strip tabs/newlines).
export const safeNext = (next?: string | null): string => {
  if (!next || !next.startsWith('/') || /[\u0000-\u001F\\]/.test(next)) return '/dashboard';
  try {
    const url = new URL(next, 'https://contractiq.invalid');
    if (url.origin !== 'https://contractiq.invalid') return '/dashboard';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/dashboard';
  }
};

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
