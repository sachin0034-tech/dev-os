'use client';

import { useActionState, useState } from 'react';
import { updatePassword } from '@/app/(auth)/actions';
import { Alert } from '@/components/ui/alert';
import { resetPasswordSchema } from '@/lib/validation/auth';
import { FormField } from './form-field';
import { PasswordInput } from './password-input';
import { PasswordRules } from './password-rules';
import { SubmitButton } from './submit-button';

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, null);
  const [password, setPassword] = useState('');
  const [clientErrors, setClientErrors] = useState<Record<string, string[] | undefined>>({});
  const serverErrors = state && !state.ok ? state.fieldErrors : undefined;
  const err = (k: 'password' | 'confirm') => clientErrors[k]?.[0] ?? serverErrors?.[k]?.[0];

  return (
    <form
      action={action}
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        const d = new FormData(e.currentTarget);
        const parsed = resetPasswordSchema.safeParse({ password: d.get('password'), confirm: d.get('confirm') });
        if (!parsed.success) {
          e.preventDefault();
          setClientErrors(parsed.error.flatten().fieldErrors);
        } else setClientErrors({});
      }}
    >
      {state && !state.ok && state.code !== 'VALIDATION_ERROR' && <Alert tone="danger">{state.message}</Alert>}
      <FormField id="password" label="New password" error={err('password')}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!err('password')}
          aria-describedby="password-rules"
        />
        <PasswordRules id="password-rules" password={password} />
      </FormField>
      <FormField id="confirm" label="Confirm new password" error={err('confirm')}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" aria-invalid={!!err('confirm')} />
      </FormField>
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}
