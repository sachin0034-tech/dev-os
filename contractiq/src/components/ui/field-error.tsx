import { cn } from '@/lib/utils/cn';

export function FieldError({ id, message, className }: { id?: string; message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={cn('mt-1 text-body-sm text-danger-text', className)}>
      {message}
    </p>
  );
}
