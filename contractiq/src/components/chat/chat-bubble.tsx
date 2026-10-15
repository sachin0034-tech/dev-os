'use client';

import { FileText, MessagesSquare, Layers } from 'lucide-react';
import { splitCitations } from '@/lib/chat/citations';
import { cn } from '@/lib/utils/cn';
import type { ChatMessage, ChatSource } from '@/types/api';
import { CitationChip } from './citation-chip';

// Where an answer came from — Conversation Memory Layer attribution (contract-chat.md §0.4).
const SOURCE: Record<ChatSource, { label: string; Icon: typeof FileText }> = {
  contract: { label: 'From the contract', Icon: FileText },
  history: { label: 'From this conversation', Icon: MessagesSquare },
  both: { label: 'From the contract and this conversation', Icon: Layers },
};

export function SourceLabel({ source }: { source: ChatSource }) {
  const { label, Icon } = SOURCE[source];
  return (
    <span className="inline-flex items-center gap-1 text-body-sm text-secondary">
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

function ConversationChip() {
  return (
    <span
      className="mx-1 inline-flex items-center gap-1 rounded-sm border border-default bg-subtle px-1.5 align-baseline text-body-sm font-medium text-secondary"
      title="This fact comes from earlier in the conversation"
    >
      <MessagesSquare className="h-3 w-3" aria-hidden />
      Conversation
    </span>
  );
}

function RichText({
  content,
  pageCount,
  onCitationClick,
}: {
  content: string;
  pageCount: number;
  onCitationClick: (page: number) => void;
}) {
  // Plain text only (no HTML injection): "- " lines become list items; source markers become chips.
  const renderInline = (text: string, key: string) =>
    splitCitations(text).map((p, i) => {
      const k = `${key}-${i}`;
      if (p.type === 'conversation') return <ConversationChip key={k} />;
      if (p.type === 'cite') {
        return p.page >= 1 && p.page <= pageCount ? (
          <CitationChip key={k} page={p.page} onClick={onCitationClick} />
        ) : (
          <span key={k}>[Page {p.page}]</span>
        );
      }
      return <span key={k}>{p.value}</span>;
    });

  const blocks = content.split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => /^\s*[-•*]\s+/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-•*]\s+/, ''), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="whitespace-pre-wrap">
            {renderInline(block, String(bi))}
          </p>
        );
      })}
    </div>
  );
}

export function ChatBubble({
  message,
  pageCount,
  onCitationClick,
  onRetry,
  streaming,
}: {
  message: Pick<ChatMessage, 'role' | 'content' | 'missingCitation' | 'isPartial' | 'queryType'>;
  pageCount: number;
  onCitationClick: (page: number) => void;
  onRetry?: () => void;
  streaming?: boolean;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-2 rounded-lg px-3 py-3 text-body-lg',
          isUser ? 'bg-brand-tint text-primary' : 'border border-default bg-primary text-primary',
        )}
      >
        <span className="sr-only">{isUser ? 'You said:' : 'ContractIQ answered:'}</span>
        {!isUser && message.queryType && <SourceLabel source={message.queryType} />}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : message.content ? (
          <RichText content={message.content} pageCount={pageCount} onCitationClick={onCitationClick} />
        ) : (
          <TypingDots />
        )}
        {!isUser && !streaming && message.isPartial && (
          <p className="text-body-sm text-secondary">
            Response interrupted.{' '}
            {onRetry && (
              <button type="button" onClick={onRetry} className="text-brand hover:underline">
                Retry
              </button>
            )}
          </p>
        )}
        {!isUser && !streaming && !message.isPartial && message.missingCitation && (
          <p className="text-body-sm text-secondary">No source cited — verify before relying on this.</p>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex h-6 items-center gap-1" aria-label="ContractIQ is typing">
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--grey-300)]" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}
