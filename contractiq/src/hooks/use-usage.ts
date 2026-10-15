'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { Usage } from '@/types/api';

export const usageQueryKey = ['usage'] as const;

export function useUsage(initialData?: Usage) {
  return useQuery({
    queryKey: usageQueryKey,
    queryFn: () => apiFetch<Usage>('/api/usage'),
    staleTime: 60_000,
    initialData,
  });
}
