'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, apiFetch } from '@/lib/api/client';
import type { ContractDetailResponse, KeyTerm } from '@/types/api';
import { contractQueryKey } from './use-contract';

type Body = { value: string } | { revert: true };

// Optimistic key-term edit — docs/specs/key-term-editing.md §5.
export function useUpdateKeyTerm(contractId: string) {
  const qc = useQueryClient();
  const key = contractQueryKey(contractId);

  const replaceTerm = (data: ContractDetailResponse | undefined, id: string, fn: (t: KeyTerm) => KeyTerm) =>
    data && { ...data, keyTerms: data.keyTerms.map((t) => (t.id === id ? fn(t) : t)) };

  return useMutation<KeyTerm, ApiError, { id: string; body: Body }, { prev?: ContractDetailResponse }>({
    mutationFn: ({ id, body }) =>
      apiFetch<KeyTerm>(`/api/key-terms/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ContractDetailResponse>(key);
      qc.setQueryData<ContractDetailResponse | undefined>(key, (d) =>
        replaceTerm(d, id, (t) => {
          if ('revert' in body) return { ...t, value: t.originalValue, isEdited: false, editedAt: null };
          const value = body.value.trim() || null;
          return { ...t, value, isEdited: value !== t.originalValue };
        }),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      qc.setQueryData(key, ctx?.prev);
      toast.error(err.code === 'RATE_LIMITED' ? err.message : "Couldn't save your edit. Try again.");
    },
    onSuccess: (term) => qc.setQueryData<ContractDetailResponse | undefined>(key, (d) => replaceTerm(d, term.id, () => term)),
  });
}
