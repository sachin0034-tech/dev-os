import type { ContractListResponse } from '@/types/api';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-default bg-primary p-4">
      <span className="text-h5">{value}</span>
      <span className="text-body-sm text-secondary">{label}</span>
    </div>
  );
}

export function SummaryCards({ summary }: { summary: ContractListResponse['summary'] }) {
  return (
    <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Contracts reviewed" value={summary.total} />
      <StatCard label="NDAs" value={summary.nda} />
      <StatCard label="MSAs" value={summary.msa} />
    </section>
  );
}
