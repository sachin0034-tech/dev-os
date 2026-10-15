import 'server-only';
import { splitPages } from '@/lib/pdf/page-markers';
import type { RequestedTerm } from './prompts/extraction/types';
import type { ExtractionOutput } from './schemas';

// Deterministic fixture responses used when AI_MOCK_MODE=true (E2E tests, demos without OpenAI).
const MOCK_SCORES = [92, 64, 31];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockExtraction(requested: RequestedTerm[], contractText: string): Promise<ExtractionOutput> {
  await sleep(1500);
  const firstPage = splitPages(contractText)[0]?.text ?? '';
  const firstSentence = (firstPage.match(/[^.!?]+[.!?]/)?.[0] ?? firstPage.slice(0, 200)).trim() || null;
  return {
    terms: requested.map((r, i) => {
      const score = MOCK_SCORES[i % MOCK_SCORES.length]!;
      return {
        term_key: r.key,
        term_name: r.name,
        value: firstSentence ? `Sample value for ${r.name}.` : null,
        page_number: firstSentence ? 1 : null,
        confidence_score: firstSentence ? score : 0,
        source_sentence: firstSentence,
      };
    }),
  };
}

// Mock chat answers per memory-layer query type (contract-chat.md §0).
export function mockChatAnswer(
  queryType: 'contract' | 'history' | 'both',
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): string {
  if (/unicorn/i.test(message)) return 'I cannot find this in the document.';
  const firstQuestion = history.find((m) => m.role === 'user')?.content;
  if (queryType === 'history') {
    return firstQuestion
      ? `Your first question was: "${firstQuestion}" [From conversation]`
      : "We haven't discussed that yet in this conversation. [From conversation]";
  }
  if (queryType === 'both') {
    return 'Earlier I said the agreement is governed by Delaware law [From conversation]. The contract confirms the laws of Delaware apply [Page 1].';
  }
  return 'Based on the document, the agreement is governed by the laws of Delaware [Page 1].';
}
