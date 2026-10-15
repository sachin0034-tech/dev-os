'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { ListContractsQuery } from '@/lib/validation/contracts';
import type { ContractListResponse } from '@/types/api';

export function useContracts(q: ListContractsQuery, initialData?: ContractListResponse) {
  const params = new URLSearchParams({ sort: q.sort, dir: q.dir, page: String(q.page), pageSize: String(q.pageSize) });
  return useQuery({
    queryKey: ['contracts', q],
    queryFn: () => apiFetch<ContractListResponse>(`/api/contracts?${params}`),
    placeholderData: keepPreviousData,
    initialData,
  });
}
