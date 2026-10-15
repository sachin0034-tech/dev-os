'use client';

import { useActionState, useState } from 'react';
import { requestPasswordReset } from '@/app/(auth)/actions';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { FormField } from './form-field';
import { SubmitButton } from './submit-button';

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  const [clientError, setClientError] = useState<string>();
  const serverError = state && !state.ok ? state.fieldErrors?.email?.[0] : undefined;

  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;

  return (
    <form
      action={action}
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        const parsed = forgotPasswordSchema.safeParse({ email: new FormData(e.currentTarget).get('email') });
        if (!parsed.success) {
          e.preventDefault();
          setClientError(parsed.error.flatten().fieldErrors.email?.[0]);
        } else setClientError(undefined);
      }}
    >
      {state && !state.ok && state.code !== 'VALIDATION_ERROR' && <Alert tone="danger">{state.message}</Alert>}
      <FormField id="email" label="Email" error={clientError ?? serverError}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!(clientError ?? serverError)} />
      </FormField>
      <SubmitButton>Send reset link</SubmitButton>
    </form>
  );
}
