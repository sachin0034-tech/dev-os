import { cn } from '@/lib/utils/cn';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex w-full max-w-[400px] flex-col gap-6 rounded-lg border border-default bg-primary p-8',
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-h5">{title}</h1>
        {subtitle && <p className="text-body-sm text-secondary">{subtitle}</p>}
      </header>
      {children}
      {footer && <footer className="text-body-sm text-secondary">{footer}</footer>}
    </section>
  );
}
