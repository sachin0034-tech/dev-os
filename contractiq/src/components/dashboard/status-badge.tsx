import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ContractStatus } from '@/types/api';

const MAP: Record<ContractStatus, { tone: 'info' | 'success' | 'danger' | 'neutral'; label: string }> = {
  uploading: { tone: 'neutral', label: 'Uploading' },
  ready: { tone: 'info', label: 'Ready to process' },
  processing: { tone: 'info', label: 'Processing' },
  completed: { tone: 'success', label: 'Reviewed' },
  error: { tone: 'danger', label: 'Failed' },
};

export function StatusBadge({ status }: { status: ContractStatus }) {
  const { tone, label } = MAP[status];
  return (
    <Badge tone={tone}>
      {status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
      {label}
    </Badge>
  );
}
