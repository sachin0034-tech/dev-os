import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { fieldClasses } from './input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldClasses, 'min-h-[80px] resize-none py-2', className)} {...props} />
));
Textarea.displayName = 'Textarea';
