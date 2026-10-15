'use client';

export function PageLink({ page, onNavigate }: { page: number | null; onNavigate: () => void }) {
  if (page === null) return <span className="text-body-sm text-secondary">Page not identified</span>;
  return (
    <button
      type="button"
      onClick={onNavigate}
      aria-label={`Go to page ${page}`}
      className="text-body-sm font-medium text-brand underline-offset-4 hover:underline"
      data-tour="page-link"
    >
      p. {page}
    </button>
  );
}
