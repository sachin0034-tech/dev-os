import type { QueryType } from '@/lib/chat/classify-query';

// Source attribution markers shared by the chat service and chat UI — contract-chat.md §0.3–0.4.
const MARKER_RE = /\[Page\s+(\d{1,3})\]|\[From conversation\]/gi;
const PAGE_RE = /\[Page\s+(\d{1,3})\]/gi;
const CONVERSATION_RE = /\[From conversation\]/i;

export const FROM_CONVERSATION = '[From conversation]';
export const NOT_FOUND_CONTRACT = 'I cannot find this in the document.';
export const NOT_FOUND_HISTORY = "We haven't discussed that yet in this conversation.";

export const parseCitations = (s: string): number[] =>
  [...new Set([...s.matchAll(PAGE_RE)].map((m) => Number(m[1])))].sort((a, b) => a - b);

export const citesConversation = (s: string): boolean => CONVERSATION_RE.test(s);

export const isNotFoundAnswer = (s: string): boolean =>
  /i cannot find this in the document/i.test(s) || /we haven'?t discussed that yet/i.test(s);

/** True when the answer lacks the attribution its query type requires. */
export function isMissingAttribution(text: string, queryType: QueryType, citedPages: number[]): boolean {
  if (!text.trim()) return false;
  if (queryType === 'history') return !citesConversation(text);
  if (isNotFoundAnswer(text)) return false;
  if (queryType === 'contract') return citedPages.length === 0;
  return citedPages.length === 0 && !citesConversation(text);
}

export type CitationPart =
  | { type: 'text'; value: string }
  | { type: 'cite'; page: number }
  | { type: 'conversation' };

export function splitCitations(s: string): CitationPart[] {
  const parts: CitationPart[] = [];
  let last = 0;
  for (const m of s.matchAll(MARKER_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ type: 'text', value: s.slice(last, idx) });
    parts.push(m[1] ? { type: 'cite', page: Number(m[1]) } : { type: 'conversation' });
    last = idx + m[0].length;
  }
  if (last < s.length) parts.push({ type: 'text', value: s.slice(last) });
  return parts;
}
