import { cn } from '@/lib/utils/cn';
import { AppFooter } from './app-footer';

// Standard app page wrapper — design-tokens.md §4 (page padding, 40px section gap, footer).
export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <>
      <main
        id="main"
        className={cn('flex flex-1 flex-col gap-10 px-4 py-6 md:px-12 md:py-12 xl:px-28 xl:py-24', className)}
      >
        {children}
      </main>
      <AppFooter />
    </>
  );
}
