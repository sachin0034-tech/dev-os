'use client';

import { ArrowDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useChatHistory } from '@/hooks/use-chat-history';
import { useChatStream } from '@/hooks/use-chat-stream';
import type { ContractType } from '@/types/api';
import { ChatBubble } from './chat-bubble';
import { ChatComposer } from './chat-composer';
import { SuggestedQuestions } from './suggested-questions';

const NEAR_BOTTOM_PX = 80;

// Grounded contract chat — docs/specs/contract-chat.md §8.
export function ChatTab({
  contractId,
  contractType,
  pageCount,
  ready,
  onCitationClick,
}: {
  contractId: string;
  contractType: ContractType;
  pageCount: number;
  ready: boolean;
  onCitationClick: (page: number) => void;
}) {
  const history = useChatHistory(contractId);
  const chat = useChatStream(contractId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number }>();

  const messages = history.data?.messages ?? [];
  const streaming = chat.status === 'streaming';

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [messages.length, chat.streamingText, chat.pendingUser, pinned]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX);
  };

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const blocked = chat.error?.code === 'PROMPT_INJECTION';

  // A blocked message was never sent or stored: give it back so the user can rephrase.
  useEffect(() => {
    if (blocked && chat.error?.retryContent) setPrefill({ text: chat.error.retryContent, nonce: Date.now() });
  }, [blocked, chat.error]);

  if (!ready) {
    return (
      <div className="p-4">
        <Alert tone="info" title="Chat is available once the analysis finishes.">
          You&apos;ll be able to ask questions about this contract as soon as its key terms are ready.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto p-4">
        {history.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="ml-auto h-10 w-2/3" />
            <Skeleton className="h-20 w-3/4" />
          </div>
        ) : history.isError ? (
          <Alert tone="danger">
            Couldn&apos;t load this chat.{' '}
            <button type="button" className="underline" onClick={() => void history.refetch()}>
              Retry
            </button>
          </Alert>
        ) : (
          <div role="log" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-2">
            {messages.length === 0 && !chat.pendingUser && !streaming && (
              <SuggestedQuestions
                contractType={contractType}
                onPick={(q) => setPrefill({ text: q, nonce: Date.now() })}
              />
            )}
            {messages.map((m, i) => (
              <ChatBubble
                key={m.id}
                message={m}
                pageCount={pageCount}
                onCitationClick={onCitationClick}
                onRetry={
                  i === messages.length - 1 && m.isPartial && lastUser
                    ? () => void chat.send(lastUser.content)
                    : undefined
                }
              />
            ))}
            {chat.pendingUser && (
              <ChatBubble
                message={{ role: 'user', content: chat.pendingUser, queryType: null, missingCitation: false, isPartial: false }}
                pageCount={pageCount}
                onCitationClick={onCitationClick}
              />
            )}
            {streaming && (
              <ChatBubble
                streaming
                message={{ role: 'assistant', content: chat.streamingText, queryType: chat.streamingSource, missingCitation: false, isPartial: false }}
                pageCount={pageCount}
                onCitationClick={onCitationClick}
              />
            )}
            {chat.status === 'error' && chat.error && chat.error.code !== 'RATE_LIMITED' && (
              <Alert tone={blocked ? 'warning' : 'danger'}>
                {chat.error.message}{' '}
                {chat.error.detail && <span className="mt-1 block break-words font-mono text-body-sm">{chat.error.detail}</span>}
                {!blocked && (
                  <button type="button" className="font-medium underline" onClick={chat.retry}>
                    Retry
                  </button>
                )}
              </Alert>
            )}
          </div>
        )}
        {!pinned && (
          <Button
            size="sm"
            variant="secondary"
            className="sticky bottom-2 left-1/2 mx-auto mt-2 flex -translate-x-0"
            onClick={() => {
              setPinned(true);
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
            }}
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            New messages
          </Button>
        )}
      </div>
      <ChatComposer
        onSend={(m) => {
          setPinned(true);
          void chat.send(m);
        }}
        onStop={chat.stop}
        streaming={streaming}
        disabledFor={chat.error?.code === 'RATE_LIMITED' ? (chat.error.retryAfter ?? 60) : undefined}
        prefill={prefill}
      />
    </div>
  );
}
