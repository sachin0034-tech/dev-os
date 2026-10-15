'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { ContractDetailResponse } from '@/types/api';

export const contractQueryKey = (id: string) => ['contract', id] as const;

// Contract detail; polls every 2 s while processing (results-page-and-key-terms.md §5).
export function useContract(id: string, initialData?: ContractDetailResponse) {
  return useQuery({
    queryKey: contractQueryKey(id),
    queryFn: () => apiFetch<ContractDetailResponse>(`/api/contracts/${id}`),
    initialData,
    refetchInterval: (q) => (q.state.data?.contract.status === 'processing' ? 2000 : false),
  });
}
