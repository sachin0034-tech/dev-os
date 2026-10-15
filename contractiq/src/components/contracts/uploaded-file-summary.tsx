import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatNumber, pluralize } from '@/lib/utils/format';
import type { ContractDetail } from '@/types/api';

export function UploadedFileSummary({ contract }: { contract: ContractDetail }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-default bg-primary p-4">
      <FileText className="h-5 w-5 shrink-0 text-brand" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body-lg" title={contract.fileName}>
          {contract.fileName}
        </span>
        <span className="text-body-sm text-secondary">
          {pluralize(contract.pageCount ?? 0, 'page')} · {formatNumber(contract.wordCount)} words
        </span>
      </div>
      <Badge tone="success">Text extracted</Badge>
    </div>
  );
}
