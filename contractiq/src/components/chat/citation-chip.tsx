'use client';

export function CitationChip({ page, onClick }: { page: number; onClick: (page: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(page)}
      aria-label={`Go to page ${page}`}
      className="mx-1 inline-flex items-center rounded-sm border border-info-border bg-info-tint px-1.5 align-baseline text-body-sm font-medium text-info-text hover:underline"
    >
      Page {page}
    </button>
  );
}
