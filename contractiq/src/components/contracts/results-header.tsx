'use client';

import { ArrowLeft, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, pluralize } from '@/lib/utils/format';
import type { ContractDetail } from '@/types/api';
import { DeleteContractDialog } from './delete-contract-dialog';

export function ResultsHeader({ contract }: { contract: ContractDetail }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = [
    contract.pageCount ? pluralize(contract.pageCount, 'page') : null,
    contract.processingCompletedAt ? `Reviewed ${formatDate(contract.processingCompletedAt)}` : null,
  ].filter(Boolean);

  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-default bg-primary px-4 md:px-6">
      <Link
        href="/dashboard"
        aria-label="Back to dashboard"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-subtle"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="truncate text-body-lg" title={contract.fileName}>
          {contract.fileName}
        </h1>
        <Badge tone="neutral">{contract.contractType}</Badge>
        <span className="hidden truncate text-body-sm text-secondary md:inline">{meta.join(' · ')}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Contract actions"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-subtle"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem destructive disabled={contract.status === 'processing'} onSelect={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete contract
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteContractDialog
        contractId={contract.id}
        fileName={contract.fileName}
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onDeleted={() => router.push('/dashboard')}
      />
    </div>
  );
}
