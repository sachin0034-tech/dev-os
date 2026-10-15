import {
  MAX_CHAT_HISTORY_TOKENS,
  MAX_CHAT_MESSAGE_CHARS,
  MAX_CONTRACT_TOKENS,
  MAX_FILE_BYTES,
  MAX_PAGES,
} from '@/lib/constants/limits';

// Token & usage limits — docs/security/security-plan.md §5.
// Values follow the PRD (20 pages / ~15k tokens / 2,000-char messages), which are stricter
// than the generic security-skill defaults; MAX_CHAT_HISTORY is an additional hard cap.

const DEFAULT_MAX_CHAT_HISTORY = 100;

const readMaxChatHistory = (): number => {
  const raw = Number(process.env.MAX_CHAT_HISTORY);
  return Number.isInteger(raw) && raw > 0 && raw <= 1000 ? raw : DEFAULT_MAX_CHAT_HISTORY;
};

export const LIMITS = {
  maxFileBytes: MAX_FILE_BYTES, // matches the storage bucket's file_size_limit
  maxPages: MAX_PAGES,
  maxContractTokens: MAX_CONTRACT_TOKENS,
  maxMessageChars: MAX_CHAT_MESSAGE_CHARS,
  maxHistoryTokens: MAX_CHAT_HISTORY_TOKENS,
  /** Hard cap on chat messages loaded/sent to the model (env MAX_CHAT_HISTORY, default 100). */
  get maxChatHistory(): number {
    return readMaxChatHistory();
  },
} as const;

export const isWithinFileSize = (bytes: number) => bytes > 0 && bytes <= LIMITS.maxFileBytes;
export const isWithinPageLimit = (pages: number) => pages >= 1 && pages <= LIMITS.maxPages;
export const isWithinMessageLimit = (text: string) => text.length >= 1 && text.length <= LIMITS.maxMessageChars;

/** Keeps the most recent messages within MAX_CHAT_HISTORY. */
export function capChatHistory<T>(messages: T[]): T[] {
  const cap = LIMITS.maxChatHistory;
  return messages.length > cap ? messages.slice(messages.length - cap) : messages;
}
