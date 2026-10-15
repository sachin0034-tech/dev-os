'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, apiFetch } from '@/lib/api/client';
import { contractQueryKey } from './use-contract';

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => apiFetch<void>(`/api/contracts/${id}`, { method: 'DELETE' }),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: contractQueryKey(id) });
      void qc.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract deleted');
    },
    onError: (err) =>
      toast.error(
        err.code === 'INVALID_STATE' ? 'Wait for the analysis to finish before deleting.' : "Couldn't delete the contract. Try again.",
      ),
  });
}
