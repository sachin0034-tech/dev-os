'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '@/lib/api/client';
import type { KeyTerm } from '@/types/api';
import { contractQueryKey } from './use-contract';
import { usageQueryKey } from './use-usage';

export interface ProcessResponse {
  contractId: string;
  status: 'completed';
  processingMs: number;
  keyTerms: KeyTerm[];
}

// POST /api/contracts/{id}/process — docs/specs/ai-extraction-pipeline.md §10
export function useProcessContract(contractId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<ProcessResponse, ApiError>({
    mutationFn: () =>
      apiFetch<ProcessResponse>(`/api/contracts/${contractId}/process`, { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usageQueryKey }),
        queryClient.invalidateQueries({ queryKey: contractQueryKey(contractId ?? '') }),
        queryClient.invalidateQueries({ queryKey: ['contracts'] }),
      ]);
    },
  });
}
