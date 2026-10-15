import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const alertVariants = cva('flex gap-2 rounded-md border px-3 py-2 text-body-sm', {
  variants: {
    tone: {
      info: 'border-info-border bg-info-tint text-info-text',
      success: 'border-success-border bg-success-tint text-success-text',
      warning: 'border-warning-border bg-warning-tint text-warning-text',
      danger: 'border-danger-border bg-danger-tint text-danger-text',
      neutral: 'border-default bg-subtle text-secondary',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle, neutral: Info };

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ className, tone = 'info', title, children, role, ...props }: AlertProps) {
  const Icon = ICONS[tone ?? 'info'];
  return (
    <div
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
