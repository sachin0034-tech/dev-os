'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { ContractDetailResponse } from '@/types/api';

export function useContractText(contractId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['contract-text', contractId],
    queryFn: async () =>
      (await apiFetch<ContractDetailResponse>(`/api/contracts/${contractId}?include=text`)).contractText ?? '',
    enabled,
    staleTime: Infinity,
  });
}
