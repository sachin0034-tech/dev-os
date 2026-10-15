'use client';

import { useActionState, useEffect, useState } from 'react';
import { resendVerification } from '@/app/(auth)/actions';
import { Alert } from '@/components/ui/alert';
import { SubmitButton } from './submit-button';

const COOLDOWN_SECONDS = 60;

export function ResendVerification({ email, label = 'Resend verification email' }: { email: string; label?: string }) {
  const [state, action] = useActionState(resendVerification, null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (state?.ok) setCooldown(COOLDOWN_SECONDS);
  }, [state]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="email" value={email} />
      <SubmitButton variant="secondary" disabled={cooldown > 0 || !email}>
        {cooldown > 0 ? `Resend available in ${cooldown}s` : label}
      </SubmitButton>
      {state?.ok && <Alert tone="success">{state.message}</Alert>}
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
    </form>
  );
}
