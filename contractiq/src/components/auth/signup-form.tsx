'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signUp } from '@/app/(auth)/actions';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { signUpSchema } from '@/lib/validation/auth';
import { FormField } from './form-field';
import { PasswordInput } from './password-input';
import { PasswordRules } from './password-rules';
import { SubmitButton } from './submit-button';

export function SignupForm() {
  const [state, action] = useActionState(signUp, null);
  const [password, setPassword] = useState('');
  const [clientErrors, setClientErrors] = useState<Record<string, string[] | undefined>>({});

  const serverFieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const fieldError = (name: 'email' | 'password') =>
    clientErrors[name]?.[0] ?? serverFieldErrors?.[name]?.[0];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({ email: data.get('email'), password: data.get('password') });
    if (!parsed.success) {
      e.preventDefault();
      setClientErrors(parsed.error.flatten().fieldErrors);
    } else {
      setClientErrors({});
    }
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {state && !state.ok && state.code !== 'VALIDATION_ERROR' && (
        <Alert tone="danger">
          {state.message}{' '}
          {state.code === 'EMAIL_TAKEN' && (
            <Link href="/login" className="font-medium underline">
              Sign in
            </Link>
          )}
        </Alert>
      )}
      <FormField id="email" label="Email" error={fieldError('email')}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={!!fieldError('email')}
          aria-describedby={fieldError('email') ? 'email-error' : undefined}
        />
      </FormField>
      <FormField id="password" label="Password" error={fieldError('password')}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!fieldError('password')}
          aria-describedby="password-rules"
        />
        <PasswordRules id="password-rules" password={password} />
      </FormField>
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
