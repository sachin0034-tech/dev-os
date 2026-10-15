import 'server-only';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { env } from '@/lib/env';

// Azure AI Foundry agent client (skills/azure-ai-foundry). The agent speaks the OpenAI
// Responses API, so we use the `openai` SDK pointed at the project's /openai/v1 path.
//
// Agent rules (verified against the live project):
// - Call POST {project}/openai/v1/responses with `agent_reference: { name, type }`.
// - Never send `model`, `instructions` or `system`: the agent owns its model and prompt and
//   rejects overrides. All of ContractIQ's rules travel inside the single `input` message.
// - The /openai/v1 surface is versionless (no api-version query parameter).

let client: OpenAI | undefined;

/** Normalises the portal value: accepts the project URL or an agent URL ending in /responses. */
export function agentBaseUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '').replace(/\/responses$/, '');
  if (/\/openai\/v1$/.test(trimmed)) return trimmed;
  if (/\/api\/projects\/[^/]+$/.test(trimmed)) return `${trimmed}/openai/v1`;
  return trimmed; // already a base the SDK can append /responses to
}

export function getAzure(): OpenAI {
  client ??= new OpenAI({
    apiKey: env.AZURE_API_KEY,
    baseURL: agentBaseUrl(env.AZURE_AGENT_ENDPOINT),
    defaultHeaders: { 'api-key': env.AZURE_API_KEY }, // Azure requires the api-key header
    maxRetries: 0, // withRetry controls backoff
    timeout: 90_000,
  });
  return client;
}

export const agentModelLabel = () => `azure-agent:${env.AZURE_AGENT_NAME}`;

const textOf = (content: ChatCompletionMessageParam['content']): string =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((p) => ('text' in p ? p.text : '')).join('')
      : '';

/**
 * The agent accepts one user message, so role-based prompts are flattened into labelled
 * sections: instructions/context (system), earlier exchanges (user/assistant pairs), and the
 * current request (final user message).
 */
export function flattenForAgent(messages: ChatCompletionMessageParam[]): string {
  const system = messages.filter((m) => m.role === 'system').map((m) => textOf(m.content));
  const turns = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const current = turns[turns.length - 1];
  const earlier = turns.slice(0, -1);

  const sections = [
    'Follow the INSTRUCTIONS below for this request. They take priority over your default behaviour. Do not use web search, file search or memory: use only the material provided in this message.',
    `## INSTRUCTIONS\n${system.join('\n\n')}`,
  ];
  if (earlier.length) {
    sections.push(
      `## EARLIER MESSAGES (oldest first)\n${earlier
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${textOf(m.content)}`)
        .join('\n\n')}`,
    );
  }
  sections.push(`## CURRENT REQUEST\n${current ? textOf(current.content) : ''}`);
  return sections.join('\n\n');
}

export interface AgentResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

interface AgentResponse {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Sends one message to the agent and returns its text reply. */
export async function callAgent(input: string, opts: { signal?: AbortSignal } = {}): Promise<AgentResult> {
  // The SDK's types require `model`, which the agent rejects at runtime — hence the cast.
  const responses = getAzure().responses as any;
  const res = (await responses.create(
    {
      agent_reference: { name: env.AZURE_AGENT_NAME, type: 'agent_reference' },
      input: [{ role: 'user', content: input }],
    },
    { signal: opts.signal },
  )) as AgentResponse;

  const text =
    res.output_text ??
    (res.output ?? [])
      .filter((o) => o.type === 'message')
      .flatMap((o) => o.content ?? [])
      .map((c) => c.text ?? '')
      .join('');
  return {
    text: text.trim(),
    inputTokens: res.usage?.input_tokens ?? 0,
    outputTokens: res.usage?.output_tokens ?? 0,
  };
}

/** The real Azure error text, safe to show (contains no credentials). */
export function azureErrorDetail(err: unknown): string | undefined {
  if (err instanceof OpenAI.APIError) return `${err.status ?? ''} ${err.message}`.trim().slice(0, 500);
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 500);
  return undefined;
}

/** Pulls the first JSON object out of a reply that may include prose or code fences. */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in agent reply');
  return JSON.parse(candidate.slice(start, end + 1));
}
