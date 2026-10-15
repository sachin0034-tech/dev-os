import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

// Status badge — design-tokens.md §5/§6. Always pair colour with text (and icon where defined).
export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-2 py-0.5 text-body-sm font-medium',
  {
    variants: {
      tone: {
        success: 'border-success-border bg-success-tint text-success-text',
        warning: 'border-warning-border bg-warning-tint text-warning-text',
        danger: 'border-danger-border bg-danger-tint text-danger-text',
        info: 'border-info-border bg-info-tint text-info-text',
        accent: 'border-accent-border bg-accent-tint text-accent-text',
        neutral: 'border-default bg-subtle text-secondary',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
