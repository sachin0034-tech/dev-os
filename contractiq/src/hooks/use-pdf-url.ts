'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

export function usePdfUrl(contractId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['pdf-url', contractId],
    queryFn: () => apiFetch<{ url: string; expiresAt: string }>(`/api/contracts/${contractId}/pdf-url`),
    enabled,
    staleTime: 50 * 60_000, // URL valid for 60 min
    retry: false,
  });
}
