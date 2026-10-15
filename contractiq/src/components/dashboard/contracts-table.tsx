'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Trash2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DeleteContractDialog } from '@/components/contracts/delete-contract-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useContracts } from '@/hooks/use-contracts';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { ListContractsQuery } from '@/lib/validation/contracts';
import type { ContractListResponse, ContractSummary } from '@/types/api';
import { EmptyState } from './empty-state';
import { StatusBadge } from './status-badge';
import { SummaryCards } from './summary-cards';

type SortKey = ListContractsQuery['sort'];

const hrefFor = (c: ContractSummary) => (c.status === 'ready' ? `/contracts/new?resume=${c.id}` : `/contracts/${c.id}`);

function SortHeader({
  column,
  label,
  q,
  onSort,
  className,
}: {
  column: SortKey;
  label: string;
  q: ListContractsQuery;
  onSort: (c: SortKey) => void;
  className?: string;
}) {
  const active = q.sort === column;
  const Icon = !active ? ArrowUpDown : q.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (q.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-4 text-left font-normal', className)}
    >
      <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-primary">
        {label}
        <Icon className="h-3 w-3" aria-hidden />
      </button>
    </th>
  );
}

function RowMenu({ contract, onDelete }: { contract: ContractSummary; onDelete: () => void }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${contract.fileName}`}
        onClick={(e) => e.stopPropagation()}
        className="flex h-8 w-8 items-center justify-center rounded-md text-secondary hover:bg-subtle"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => router.push(hrefFor(contract))}>Open</DropdownMenuItem>
        <DropdownMenuItem destructive disabled={contract.status === 'processing'} onSelect={onDelete}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Sortable, paginated contract history — docs/specs/dashboard.md §6.
export function ContractsTable({ initialQuery, initialData }: { initialQuery: ListContractsQuery; initialData: ContractListResponse }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState<ListContractsQuery>(initialQuery);
  const isInitial =
    q.sort === initialQuery.sort && q.dir === initialQuery.dir && q.page === initialQuery.page && q.pageSize === initialQuery.pageSize;
  const { data = initialData, isFetching } = useContracts(q, isInitial ? initialData : undefined);
  const [toDelete, setToDelete] = useState<ContractSummary | null>(null);

  const update = (next: ListContractsQuery) => {
    setQ(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', next.sort);
    params.set('dir', next.dir);
    params.set('page', String(next.page));
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const onSort = (column: SortKey) =>
    update({
      ...q,
      sort: column,
      dir: q.sort === column ? (q.dir === 'asc' ? 'desc' : 'asc') : column === 'created_at' ? 'desc' : 'asc',
      page: 1,
    });

  const pageCount = Math.max(1, Math.ceil(data.total / q.pageSize));
  const from = data.total === 0 ? 0 : (q.page - 1) * q.pageSize + 1;
  const to = Math.min(data.total, q.page * q.pageSize);

  return (
    <>
      <SummaryCards summary={data.summary} />
      {data.total === 0 ? (
        <EmptyState />
      ) : (
        <section aria-labelledby="contracts-title" className="flex flex-col gap-4">
          <h2 id="contracts-title" className="text-h5">
            Contract history
          </h2>

          {/* Desktop table */}
          <div className={cn('hidden overflow-hidden rounded-lg border border-default bg-primary sm:block', isFetching && 'opacity-70')}>
            <table className="w-full text-body-lg">
              <caption className="sr-only">Your contracts</caption>
              <thead className="bg-surface text-body-sm text-secondary">
                <tr className="h-10">
                  <SortHeader column="file_name" label="Name" q={q} onSort={onSort} />
                  <SortHeader column="contract_type" label="Type" q={q} onSort={onSort} />
                  <SortHeader column="created_at" label="Uploaded" q={q} onSort={onSort} />
                  <SortHeader column="status" label="Status" q={q} onSort={onSort} />
                  <th scope="col" className="px-4 text-right font-normal">
                    Low confidence
                  </th>
                  <th scope="col" className="w-12">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr
                    key={c.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${c.fileName}`}
                    onClick={() => router.push(hrefFor(c))}
                    onKeyDown={(e) => e.key === 'Enter' && router.push(hrefFor(c))}
                    className="h-12 cursor-pointer border-t border-default hover:bg-subtle"
                  >
                    <td className="max-w-[320px] truncate px-4" title={c.fileName}>
                      {c.fileName}
                    </td>
                    <td className="px-4">
                      <Badge tone="neutral">{c.contractType}</Badge>
                    </td>
                    <td className="px-4 text-body-sm text-secondary">{formatDate(c.createdAt)}</td>
                    <td className="px-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 text-right">
                      {c.lowConfidenceCount > 0 ? <Badge tone="danger">{c.lowConfidenceCount}</Badge> : <span className="text-secondary">—</span>}
                    </td>
                    <td className="px-2">
                      <RowMenu contract={c} onDelete={() => setToDelete(c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {data.items.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 rounded-lg border border-default bg-primary p-4">
                <button type="button" onClick={() => router.push(hrefFor(c))} className="flex min-w-0 flex-col items-start gap-2 text-left">
                  <span className="max-w-full truncate text-body-lg">{c.fileName}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{c.contractType}</Badge>
                    <StatusBadge status={c.status} />
                    {c.lowConfidenceCount > 0 && <Badge tone="danger">{c.lowConfidenceCount} low</Badge>}
                  </span>
                  <span className="text-body-sm text-secondary">{formatDate(c.createdAt)}</span>
                </button>
                <RowMenu contract={c} onDelete={() => setToDelete(c)} />
              </li>
            ))}
          </ul>

          {data.total > q.pageSize && (
            <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
              <span className="text-body-sm text-secondary">
                Showing {from}–{to} of {data.total}
              </span>
              <span className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={q.page <= 1} onClick={() => update({ ...q, page: q.page - 1 })}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={q.page >= pageCount} onClick={() => update({ ...q, page: q.page + 1 })}>
                  Next
                </Button>
              </span>
            </nav>
          )}
        </section>
      )}

      {toDelete && (
        <DeleteContractDialog
          contractId={toDelete.id}
          fileName={toDelete.fileName}
          open
          onOpenChange={(open) => !open && setToDelete(null)}
          onDeleted={() => {
            // Deleting the last row on a later page → go back a page.
            if (data.items.length === 1 && q.page > 1) update({ ...q, page: q.page - 1 });
          }}
        />
      )}
    </>
  );
}
