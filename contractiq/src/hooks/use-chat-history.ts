'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { ChatMessage } from '@/types/api';

export interface ChatHistory {
  sessionId: string | null;
  messages: ChatMessage[];
  hasMore: boolean;
}

export const chatQueryKey = (contractId: string) => ['chat', contractId] as const;

export function useChatHistory(contractId: string) {
  return useQuery({
    queryKey: chatQueryKey(contractId),
    queryFn: () => apiFetch<ChatHistory>(`/api/contracts/${contractId}/chat`),
  });
}
