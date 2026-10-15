'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { readSse } from '@/lib/utils/sse';
import type { ApiErrorBody, ChatMessage, ChatSource } from '@/types/api';
import { chatQueryKey, type ChatHistory } from './use-chat-history';

type Status = 'idle' | 'streaming' | 'error';

export interface ChatStreamError {
  code: string;
  message: string;
  retryOfMessageId?: string;
  retryContent?: string;
  retryAfter?: number;
  detail?: string;
}

// Streams an answer over SSE and folds the result into the chat history cache (contract-chat.md §7).
export function useChatStream(contractId: string) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('idle');
  const [streamingText, setStreamingText] = useState('');
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [streamingSource, setStreamingSource] = useState<ChatSource | null>(null);
  const [error, setError] = useState<ChatStreamError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const appendToCache = useCallback(
    (msgs: ChatMessage[]) =>
      qc.setQueryData<ChatHistory | undefined>(chatQueryKey(contractId), (d) => {
        const base = d ?? { sessionId: null, messages: [], hasMore: false };
        const ids = new Set(base.messages.map((m) => m.id));
        return { ...base, messages: [...base.messages, ...msgs.filter((m) => !ids.has(m.id))] };
      }),
    [qc, contractId],
  );

  const send = useCallback(
    async (message: string, retryOfMessageId?: string) => {
      if (status === 'streaming') return;
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus('streaming');
      setStreamingText('');
      setError(null);
      setPendingUser(retryOfMessageId ? null : message);

      let userMessageId: string | null = retryOfMessageId ?? null;
      let text = '';
      let queryType: ChatSource | null = null;
      setStreamingSource(null);
      const now = () => new Date().toISOString();
      const userMsg = (id: string): ChatMessage => ({
        id,
        role: 'user',
        content: message,
        queryType: null,
        citedPages: [],
        missingCitation: false,
        isPartial: false,
        createdAt: now(),
      });

      try {
        const res = await fetch(`/api/contracts/${contractId}/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
          body: JSON.stringify({ message, ...(retryOfMessageId ? { retryOfMessageId } : {}) }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
          if (res.status === 401) window.location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
          throw new ApiError(
            body?.error.code ?? 'INTERNAL',
            res.status,
            body?.error.message ?? 'Something went wrong. Please try again.',
            undefined,
            Number(res.headers.get('Retry-After')) || undefined,
          );
        }

        for await (const ev of readSse(res)) {
          const data = ev.data as Record<string, unknown>;
          if (ev.event === 'meta') {
            userMessageId = String(data.userMessageId);
            queryType = (data.queryType as ChatSource) ?? null;
            setStreamingSource(queryType);
            if (!retryOfMessageId) appendToCache([userMsg(userMessageId)]);
            setPendingUser(null);
          } else if (ev.event === 'token') {
            text += String(data.t ?? '');
            setStreamingText(text);
          } else if (ev.event === 'done') {
            appendToCache([
              {
                id: String(data.messageId ?? crypto.randomUUID()),
                role: 'assistant',
                content: text,
                queryType: (data.queryType as ChatSource) ?? queryType,
                citedPages: (data.citedPages as number[]) ?? [],
                missingCitation: Boolean(data.missingCitation),
                isPartial: Boolean(data.isPartial),
                createdAt: now(),
              },
            ]);
            setStreamingText('');
            setStatus('idle');
            return;
          } else if (ev.event === 'error') {
            if (data.partial && text) {
              appendToCache([
                {
                  id: String(data.messageId ?? crypto.randomUUID()),
                  role: 'assistant',
                  content: text,
                  queryType,
                  citedPages: [],
                  missingCitation: false,
                  isPartial: true,
                  createdAt: now(),
                },
              ]);
              setStreamingText('');
              setStatus('idle');
              return;
            }
            throw new ApiError(String(data.code), 502, String(data.message), undefined, undefined, undefined, data.detail ? String(data.detail) : undefined);
          }
        }
        // Stream closed without a terminal event.
        if (text) {
          appendToCache([
            { id: crypto.randomUUID(), role: 'assistant', content: text, queryType, citedPages: [], missingCitation: false, isPartial: true, createdAt: now() },
          ]);
        }
        setStreamingText('');
        setStatus('idle');
      } catch (err) {
        setPendingUser(null);
        setStreamingText('');
        if (controller.signal.aborted) {
          // User pressed Stop: the server saves the partial answer; refresh to show it.
          setStatus('idle');
          setTimeout(() => void qc.invalidateQueries({ queryKey: chatQueryKey(contractId) }), 800);
          return;
        }
        const e = err instanceof ApiError ? err : new ApiError('INTERNAL', 500, 'Something went wrong. Please try again.');
        setError({
          code: e.code,
          message: e.message,
          retryOfMessageId: userMessageId ?? undefined,
          retryContent: message,
          retryAfter: e.retryAfter,
          detail: e.detail,
        });
        if (!userMessageId) setPendingUser(null);
        setStatus('error');
      }
    },
    [contractId, status, appendToCache, qc],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const retry = useCallback(() => {
    if (error?.retryContent) void send(error.retryContent, error.retryOfMessageId);
  }, [error, send]);

  return { status, streamingText, streamingSource, pendingUser, error, send, stop, retry };
}
