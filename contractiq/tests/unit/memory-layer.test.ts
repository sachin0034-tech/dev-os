// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { buildChatMessages } from '@/lib/ai/prompts/chat/v2';
import { isMissingAttribution, parseCitations, splitCitations } from '@/lib/chat/citations';
import { classifyQuery, type HistoryMessage } from '@/lib/chat/classify-query';
import { CONTEXT_POLICY, lastTurns, prepareTurn } from '@/lib/chat/memory';

const conversation = (turns: number): HistoryMessage[] =>
  Array.from({ length: turns }, (_, i) => [
    { role: 'user' as const, content: `Question ${i + 1}` },
    { role: 'assistant' as const, content: `Answer ${i + 1} [Page 1]` },
  ]).flat();

describe('classifyQuery', () => {
  const some = conversation(2);
  it.each([
    ['What does the termination clause say?', some, 'contract'],
    ['Is there an auto-renewal clause?', [], 'contract'],
    ['What did I ask you first?', some, 'history'],
    ['Summarize our conversation so far', some, 'history'],
    ['What did you say earlier?', some, 'history'],
    ['Is the notice period you mentioned earlier 30 days?', some, 'both'],
    ['You said the liability cap was 12 months of fees — which section is that?', some, 'both'],
    ['Why?', some, 'both'],
    ['What about the second one?', some, 'both'],
    ['Why?', [], 'contract'],
    ['Why is the governing law Delaware and not New York in this agreement?', some, 'contract'],
  ] as const)('%s → %s', (q, history, expected) => {
    expect(classifyQuery(q, [...history])).toBe(expected);
  });
});

describe('lastTurns', () => {
  it('keeps the last N user turns with their replies', () => {
    const h = conversation(15);
    const ten = lastTurns(h, 10);
    expect(ten).toHaveLength(20);
    expect(ten[0]).toEqual({ role: 'user', content: 'Question 6' });
    expect(lastTurns(h, 20)).toHaveLength(30);
    expect(lastTurns([], 10)).toEqual([]);
  });
});

describe('prepareTurn — critical ordering', () => {
  it('loads history BEFORE saving the new user message', async () => {
    const calls: string[] = [];
    const loadHistory = vi.fn(async () => {
      calls.push('load');
      return conversation(1);
    });
    const saveUserMessage = vi.fn(async () => {
      calls.push('save');
      return 'new-id';
    });
    const turn = await prepareTurn({ message: 'Why?', loadHistory, saveUserMessage });
    expect(calls).toEqual(['load', 'save']);
    expect(turn.saved).toBe('new-id');
    expect(turn.queryType).toBe('both');
    expect(turn.history.some((m) => m.content === 'Why?')).toBe(false);
  });

  it('shows why order matters: saving first would misclassify a first-message follow-up', () => {
    const newMessage: HistoryMessage = { role: 'user', content: 'Why?' };
    expect(classifyQuery('Why?', [])).toBe('contract'); // correct: nothing to follow up on
    expect(classifyQuery('Why?', [newMessage])).toBe('both'); // wrong if history included the new message
  });

  it('retrieves context according to the policy', async () => {
    const history = conversation(25);
    const run = (message: string) =>
      prepareTurn({ message, loadHistory: async () => history, saveUserMessage: async () => 'id' });
    const contract = await run('What does the termination clause say?');
    expect(contract).toMatchObject({ queryType: 'contract', includeContract: true });
    expect(contract.context).toHaveLength(20); // 10 turns
    const hist = await run('What did I ask you first?');
    expect(hist).toMatchObject({ queryType: 'history', includeContract: false });
    expect(hist.context).toHaveLength(40); // 20 turns
    expect(CONTEXT_POLICY.both).toEqual({ includeContract: true, maxTurns: 10 });
  });
});

describe('buildChatMessages', () => {
  const base = {
    contractType: 'NDA' as const,
    contractText: '[PAGE 1]\nGoverned by Delaware law.',
    pageCount: 1,
    context: conversation(1),
    message: 'q',
  };
  it('omits the contract for history questions and uses the history prompt', () => {
    const msgs = buildChatMessages({ ...base, queryType: 'history', includeContract: false });
    const text = JSON.stringify(msgs);
    expect(text).not.toContain('<contract');
    expect(String(msgs[0]!.content)).toContain('[From conversation]');
    expect(msgs.at(-1)).toEqual({ role: 'user', content: 'q' });
  });
  it('includes the contract for contract and both questions', () => {
    for (const queryType of ['contract', 'both'] as const) {
      const msgs = buildChatMessages({ ...base, queryType, includeContract: true });
      expect(JSON.stringify(msgs)).toContain('<contract type=\\"NDA\\"');
    }
    expect(String(buildChatMessages({ ...base, queryType: 'contract', includeContract: true })[0]!.content)).toContain(
      'Answer ONLY from the contract',
    );
    expect(String(buildChatMessages({ ...base, queryType: 'both', includeContract: true })[0]!.content)).toContain(
      'attribute every fact',
    );
  });
});

describe('attribution', () => {
  it('parses page and conversation markers', () => {
    const s = 'Earlier I said X [From conversation]. The contract says Y [Page 2] [Page 2].';
    expect(parseCitations(s)).toEqual([2]);
    expect(splitCitations(s).map((p) => p.type)).toEqual(['text', 'conversation', 'text', 'cite', 'text', 'cite', 'text']);
  });
  it('detects missing attribution per query type', () => {
    expect(isMissingAttribution('Delaware law applies.', 'contract', [])).toBe(true);
    expect(isMissingAttribution('I cannot find this in the document.', 'contract', [])).toBe(false);
    expect(isMissingAttribution('You asked about X.', 'history', [])).toBe(true);
    expect(isMissingAttribution('You asked about X. [From conversation]', 'history', [])).toBe(false);
    expect(isMissingAttribution('Y applies [Page 1].', 'both', [1])).toBe(false);
    expect(isMissingAttribution('Y applies.', 'both', [])).toBe(true);
  });
});
