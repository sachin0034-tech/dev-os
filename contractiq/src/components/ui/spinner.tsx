import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn('h-4 w-4 animate-spin text-brand', className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
