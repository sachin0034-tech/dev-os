// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { AZURE_AGENT_NAME: 'Demoagent' } }));
const { agentBaseUrl, extractJsonObject, flattenForAgent } = await import('@/lib/azure');

describe('agentBaseUrl', () => {
  it('maps a project URL to its /openai/v1 base', () => {
    expect(agentBaseUrl('https://x.services.ai.azure.com/api/projects/p1')).toBe(
      'https://x.services.ai.azure.com/api/projects/p1/openai/v1',
    );
  });
  it('strips a trailing /responses so the SDK does not double it (405)', () => {
    expect(agentBaseUrl('https://x.services.ai.azure.com/api/projects/p1/openai/v1/responses')).toBe(
      'https://x.services.ai.azure.com/api/projects/p1/openai/v1',
    );
    expect(agentBaseUrl('https://x.services.ai.azure.com/api/projects/p1/')).toMatch(/\/openai\/v1$/);
  });
});

describe('flattenForAgent', () => {
  it('puts instructions, earlier turns and the current request into one message', () => {
    const text = flattenForAgent([
      { role: 'system', content: 'Answer only from the contract.' },
      { role: 'system', content: '<contract>[PAGE 1] Governed by Delaware law.</contract>' },
      { role: 'user', content: 'What law applies?' },
      { role: 'assistant', content: 'Delaware [Page 1].' },
      { role: 'user', content: 'Why?' },
    ]);
    expect(text).toContain('## INSTRUCTIONS\nAnswer only from the contract.');
    expect(text).toContain('<contract>[PAGE 1] Governed by Delaware law.</contract>');
    expect(text).toContain('User: What law applies?\n\nAssistant: Delaware [Page 1].');
    expect(text.trim().endsWith('## CURRENT REQUEST\nWhy?')).toBe(true);
    expect(text).toMatch(/Do not use web search/);
  });
});

describe('extractJsonObject', () => {
  it('parses plain, fenced and prose-wrapped JSON', () => {
    expect(extractJsonObject('{"terms":[]}')).toEqual({ terms: [] });
    expect(extractJsonObject('```json\n{"terms":[1]}\n```')).toEqual({ terms: [1] });
    expect(extractJsonObject('Here you go: {"terms":[2]} Thanks!')).toEqual({ terms: [2] });
  });
  it('throws when there is no JSON', () => {
    expect(() => extractJsonObject('no json here')).toThrow();
  });
});
