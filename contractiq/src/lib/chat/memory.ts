import type { HistoryMessage, QueryType } from '@/lib/chat/classify-query';
import { classifyQuery } from '@/lib/chat/classify-query';

// Conversation Memory Layer — docs/specs/contract-chat.md §0.

/** How much context each question type gets. A turn = one user message + its reply. */
export const CONTEXT_POLICY: Record<QueryType, { includeContract: boolean; maxTurns: number }> = {
  contract: { includeContract: true, maxTurns: 10 },
  history: { includeContract: false, maxTurns: 20 },
  both: { includeContract: true, maxTurns: 10 },
};

/** Messages belonging to the last `n` turns (counted by user messages), oldest first. */
export function lastTurns<T extends { role: 'user' | 'assistant' }>(messages: T[], n: number): T[] {
  if (n <= 0) return [];
  let users = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') {
      users += 1;
      if (users === n) return messages.slice(i);
    }
  }
  return messages.slice();
}

export interface PreparedTurn<H extends HistoryMessage, S> {
  history: H[]; // prior messages, loaded before the new message was saved
  queryType: QueryType;
  context: H[]; // history window sent to the model
  includeContract: boolean;
  saved: S; // result of saveUserMessage
}

/**
 * Enforces the mandatory order: LOAD history → CLASSIFY → RETRIEVE → SAVE.
 * History must never contain the new message, or follow-ups are misclassified.
 */
export async function prepareTurn<H extends HistoryMessage, S>({
  message,
  loadHistory,
  saveUserMessage,
}: {
  message: string;
  loadHistory: () => Promise<H[]>;
  saveUserMessage: () => Promise<S>;
}): Promise<PreparedTurn<H, S>> {
  const history = await loadHistory();
  const queryType = classifyQuery(message, history);
  const policy = CONTEXT_POLICY[queryType];
  const context = lastTurns(history, policy.maxTurns);
  const saved = await saveUserMessage();
  return { history, queryType, context, includeContract: policy.includeContract, saved };
}
