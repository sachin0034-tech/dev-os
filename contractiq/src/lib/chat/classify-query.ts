// Conversation Memory Layer: decides which context answers a question.
// docs/specs/contract-chat.md §0.2
export type QueryType = 'contract' | 'history' | 'both';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

// References to the conversation itself.
const HISTORY_RE =
  /\b(you (said|mentioned|told|wrote|answered|explained)|(i|we) (asked|said|mentioned|discussed|talked about)|did i (ask|say)|have we (discussed|talked)|earlier|previous(ly)?|before|above|so far|last (answer|reply|response|question)|(first|last|previous) (thing|question) i|my (first|last|previous) question|recap|remind me what|summari[sz]e (our|this|the) (chat|conversation|discussion)|our (chat|conversation|discussion))\b/i;

// References to contract topics.
const CONTRACT_RE =
  /\b(clause|section|term|terms|party|parties|agreement|contract|nda|msa|payment|invoice|liabilit\w*|indemn\w*|terminat\w*|confidential\w*|governing law|jurisdiction|notice|intellectual property|ip|renew\w*|non-?solicit\w*|non-?compete|breach|remed\w*|warrant\w*|fee|fees|page)\b/i;

// Short follow-ups that only make sense relative to the previous exchange.
const FOLLOW_UP_RE =
  /^(and|but|so|also|why|how come|what about|how about|what if|explain|elaborate|clarify|tell me more|more detail|go on|continue|can you (explain|clarify|expand|elaborate)|could you (explain|clarify|expand|elaborate)|what does (that|it|this) mean|is that|does that|was that|and that)\b/i;

const FOLLOW_UP_MAX_WORDS = 8;

/**
 * @param message  the new user message
 * @param history  prior messages ONLY — must be loaded before the new message is saved,
 *                 otherwise every follow-up looks like it has prior conversation.
 */
export function classifyQuery(message: string, history: HistoryMessage[]): QueryType {
  const text = message.trim();
  const hasHistory = history.length > 0;
  const refersToConversation = HISTORY_RE.test(text);
  const refersToContract = CONTRACT_RE.test(text);

  if (refersToConversation) return refersToContract ? 'both' : 'history';

  const words = text.split(/\s+/).filter(Boolean).length;
  if (hasHistory && words <= FOLLOW_UP_MAX_WORDS && FOLLOW_UP_RE.test(text)) return 'both';

  return 'contract';
}
