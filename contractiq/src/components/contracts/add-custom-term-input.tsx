'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { MAX_CUSTOM_TERMS } from '@/lib/constants/limits';
import { customTermNameSchema } from '@/lib/validation/custom-terms';

export function AddCustomTermInput({
  existing,
  count,
  disabled,
  onSubmit,
}: {
  existing: string[];
  count: number;
  disabled?: boolean;
  onSubmit: (termName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const atLimit = count >= MAX_CUSTOM_TERMS;

  const submit = () => {
    const parsed = customTermNameSchema.safeParse(value);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    if (existing.some((n) => n.toLowerCase() === parsed.data.toLowerCase())) {
      return setError('That term is already in the list.');
    }
    onSubmit(parsed.data);
    setValue('');
    setError(undefined);
  };

  const close = () => {
    setOpen(false);
    setValue('');
    setError(undefined);
  };

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} disabled={disabled || atLimit}>
          <Plus className="h-4 w-4" aria-hidden />
          Add Key Term
        </Button>
        <span className="text-body-sm text-secondary">
          {atLimit ? 'You can add up to 5 custom terms' : `${count}/${MAX_CUSTOM_TERMS} custom`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input
          autoFocus
          aria-label="Custom key term"
          placeholder="e.g. Non-compete radius"
          value={value}
          maxLength={80}
          aria-invalid={!!error}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape') close();
          }}
        />
        <Button size="md" onClick={submit} disabled={atLimit}>
          Add
        </Button>
        <Button size="md" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
      <FieldError message={error} />
      <span className="text-body-sm text-secondary">
        {count}/{MAX_CUSTOM_TERMS} custom
      </span>
    </div>
  );
}
