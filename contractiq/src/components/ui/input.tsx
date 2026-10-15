import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export const fieldClasses =
  'w-full rounded-md border border-default bg-primary px-3 text-body-lg text-primary placeholder:text-secondary transition-colors duration-micro ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:bg-subtle disabled:text-disabled aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-tint';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldClasses, 'h-10', className)} {...props} />
  ),
);
Input.displayName = 'Input';
