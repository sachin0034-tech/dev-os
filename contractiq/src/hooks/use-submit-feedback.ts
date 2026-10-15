'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, apiFetch } from '@/lib/api/client';
import type { ContractDetailResponse, FeedbackValue } from '@/types/api';
import { contractQueryKey } from './use-contract';

export function useSubmitFeedback(contractId: string) {
  const qc = useQueryClient();
  return useMutation<FeedbackValue, ApiError, FeedbackValue>({
    mutationFn: (body) =>
      apiFetch<FeedbackValue>(`/api/contracts/${contractId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ rating: body.rating, comment: body.comment ?? '' }),
      }),
    onSuccess: (feedback) =>
      qc.setQueryData<ContractDetailResponse | undefined>(contractQueryKey(contractId), (d) =>
        d ? { ...d, feedback: { rating: feedback.rating, comment: feedback.comment } } : d,
      ),
    onError: () => toast.error("Couldn't send feedback. Try again."),
  });
}
