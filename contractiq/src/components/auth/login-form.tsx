'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signInSchema } from '@/lib/validation/auth';
import type { ApiErrorBody } from '@/types/api';
import { FormField } from './form-field';
import { PasswordInput } from './password-input';
import { ResendVerification } from './resend-verification';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

// Posts to /api/auth/login so the session cookie is set server-side (security-plan.md §1).
export function LoginForm({ next, linkExpired }: { next?: string; linkExpired?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setFieldErrors({ email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setFieldErrors({});
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: parsed.data.email, password, ...(next ? { next } : {}) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
        setError({
          code: body?.error.code ?? 'INTERNAL',
          message: body?.error.message ?? 'Something went wrong. Please try again.',
        });
        return;
      }
      const { redirectTo } = (await res.json()) as { redirectTo: string };
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError({ code: 'INTERNAL', message: 'Something went wrong. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  const needsVerification = error?.code === 'EMAIL_NOT_CONFIRMED';

  return (
    <div className="flex flex-col gap-6">
      {linkExpired && !error && (
        <Alert tone="warning" title="This link has expired or was already used.">
          Sign in below, or enter your email and request a new link.
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {error && error.code !== 'VALIDATION_ERROR' && <Alert tone="danger">{error.message}</Alert>}
        <FormField id="email" label="Email" error={fieldErrors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
        </FormField>
        <FormField id="password" label="Password" error={fieldErrors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
        </FormField>
        <div className="-mt-4 flex justify-end">
          <Link href="/forgot-password" className="text-body-sm text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>
      {(needsVerification || (linkExpired && email)) && <ResendVerification email={email.trim()} />}
    </div>
  );
}
