import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-default bg-primary px-6">
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="flex flex-1">
        <div className="hidden w-1/2 bg-subtle p-4 lg:block">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="flex flex-1 flex-col gap-2 bg-surface p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
