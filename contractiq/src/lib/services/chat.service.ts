import 'server-only';
import { mockChatAnswer } from '@/lib/ai/mock';
import { mapOpenAiError, withRetry } from '@/lib/ai/openai-client';
import { agentModelLabel, azureErrorDetail, callAgent, flattenForAgent } from '@/lib/azure';
import { buildChatMessages, CHAT_PROMPT_VERSION } from '@/lib/ai/prompts/chat/v2';
import { isMissingAttribution, parseCitations } from '@/lib/chat/citations';
import { prepareTurn } from '@/lib/chat/memory';
import { AppError, ERROR_CATALOG, mapPgError } from '@/lib/api/errors';
import type { AuthUser } from '@/lib/api/handler';
import { MAX_CHAT_HISTORY_MESSAGES, MAX_CHAT_HISTORY_TOKENS } from '@/lib/constants/limits';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerSupabase } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { SSE_HEADERS, sseEvent } from '@/lib/utils/sse';
import { countTokens } from '@/lib/utils/tokens';
import type { ChatMessage } from '@/types/api';
import { verifyContractOwnership, verifySessionOwnership } from '@/lib/security/chatSecurity';
import { neutralizeContractText, sanitizeForLLM } from '@/lib/security/promptInjectionGuard';
import { capChatHistory, LIMITS } from '@/lib/security/tokenLimiter';
import { toChatMessage } from './mappers';
import { logUsage } from './usage.service';

const MAX_STORED_CONTENT = 8000;

// GET history — docs/specs/contract-chat.md §4
export async function getChatHistory(
  supabase: ServerSupabase,
  user: AuthUser,
  contractId: string,
  q: { before?: string; limit: number },
): Promise<{ sessionId: string | null; messages: ChatMessage[]; hasMore: boolean }> {
  await verifyContractOwnership(supabase, contractId, user.id);
  const session = await verifySessionOwnership(supabase, contractId, user.id);
  if (!session) return { sessionId: null, messages: [], hasMore: false };

  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: false })
    .limit(q.limit + 1);
  if (q.before) {
    const { data: pivot } = await supabase.from('chat_messages').select('created_at').eq('id', q.before).maybeSingle();
    if (pivot) query = query.lt('created_at', pivot.created_at);
  }
  const { data: rows, error: msgError } = await query;
  if (msgError) throw mapPgError(msgError);
  const list = rows ?? [];
  return {
    sessionId: session.id,
    messages: list.slice(0, q.limit).reverse().map(toChatMessage),
    hasMore: list.length > q.limit,
  };
}

// Oldest-first trimming to the history token budget (safety cap on top of the turn limits).
function trimToTokenBudget<T extends { content: string }>(messages: T[]): T[] {
  const out = [...messages];
  let total = countTokens(out.map((m) => m.content).join('\n'));
  while (out.length > 0 && total > MAX_CHAT_HISTORY_TOKENS) {
    const removed = out.shift()!;
    total -= countTokens(removed.content);
  }
  return out;
}

async function* mockStream(text: string): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += 5) {
    await new Promise((r) => setTimeout(r, 30));
    yield text.slice(i, i + 5);
  }
}

// POST — Conversation Memory Layer (contract-chat.md §0): LOAD → CLASSIFY → RETRIEVE → SAVE → RESPOND.
export async function streamAnswer(
  supabase: ServerSupabase,
  user: AuthUser,
  contractId: string,
  input: { message: string; retryOfMessageId?: string },
  requestSignal: AbortSignal,
): Promise<Response> {
  // Security (docs/security/security-plan.md §4, §6): block injection attempts before anything
  // is stored or sent to the model, then verify contract + session ownership.
  const message = sanitizeForLLM(input.message, { userId: user.id, field: 'chat_message' });
  const contract = await verifyContractOwnership(supabase, contractId, user.id, { requireCompleted: true });
  const session = (await verifySessionOwnership(supabase, contractId, user.id, { create: true }))!;
  const pageCount = contract.page_count ?? 1;
  const admin = createAdminClient();

  let reusedUserMessageId: string | null = null;

  const turn = await prepareTurn({
    message,
    // 1. LOAD — runs before the new message exists in the database.
    loadHistory: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })
        .limit(Math.min(MAX_CHAT_HISTORY_MESSAGES, LIMITS.maxChatHistory));
      if (error) throw mapPgError(error);
      const rows = (data ?? []).reverse();
      // Retry: the failed question is already saved as the last message — reuse it, and keep it out of history.
      const last = rows[rows.length - 1];
      if (
        input.retryOfMessageId &&
        last &&
        last.id === input.retryOfMessageId &&
        last.role === 'user' &&
        last.content === message
      ) {
        reusedUserMessageId = last.id;
        rows.pop();
      }
      return rows.map((m) => ({ id: m.id, role: m.role, content: m.content }));
    },
    // 4. SAVE — only after history has been loaded and the question classified.
    saveUserMessage: async () => {
      if (reusedUserMessageId) return reusedUserMessageId;
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({ session_id: session.id, user_id: user.id, role: 'user', content: message, query_type: null })
        .select('id')
        .single();
      if (error || !data) throw mapPgError(error);
      return data.id;
    },
  });

  const userMessageId = turn.saved;
  const queryType = turn.queryType;
  const context = capChatHistory(trimToTokenBudget(turn.context));
  const messages = buildChatMessages({
    queryType,
    contractType: contract.contract_type,
    contractText: neutralizeContractText(contract.contract_text ?? ''),
    pageCount,
    context,
    includeContract: turn.includeContract,
    message,
  });
  const model = env.AI_MOCK_MODE ? 'mock' : agentModelLabel();
  const t0 = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = '';
      let usage: { prompt_tokens: number; completion_tokens: number } | undefined;
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(sseEvent(event, data));
        } catch {
          closed = true; // client went away
        }
      };

      const finalize = async (isPartial: boolean) => {
        const citedPages = parseCitations(full).filter((p) => p >= 1 && p <= pageCount);
        const missingCitation = isMissingAttribution(full, queryType, citedPages);
        const { data: saved, error } = await admin
          .from('chat_messages')
          .insert({
            session_id: session.id,
            user_id: user.id,
            role: 'assistant',
            content: full.slice(0, MAX_STORED_CONTENT),
            cited_pages: citedPages,
            missing_citation: missingCitation,
            query_type: queryType,
            is_partial: isPartial,
            prompt_tokens: usage?.prompt_tokens ?? null,
            completion_tokens: usage?.completion_tokens ?? null,
          })
          .select('id')
          .single();
        if (error) logger.error('chat.persist_failed', { userId: user.id, contractId, code: error.code });
        await logUsage({
          userId: user.id,
          contractId,
          eventType: 'chat',
          model,
          promptVersion: CHAT_PROMPT_VERSION,
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
          latencyMs: Date.now() - t0,
          success: !isPartial,
        });
        logger.info('chat.completed', {
          userId: user.id,
          contractId,
          queryType,
          historyMessagesLoaded: turn.history.length,
          contextMessagesSent: context.length,
          contractSent: turn.includeContract,
          citedPages: citedPages.length,
          latencyMs: Date.now() - t0,
          isPartial,
        });
        return { messageId: saved?.id ?? null, citedPages, missingCitation, isPartial, queryType };
      };

      send('meta', { userMessageId, queryType });
      try {
        if (env.AI_MOCK_MODE) {
          for await (const chunk of mockStream(mockChatAnswer(queryType, message, turn.history))) {
            if (requestSignal.aborted) throw new DOMException('Aborted', 'AbortError');
            full += chunk;
            send('token', { t: chunk });
          }
        } else {
          // Azure AI Foundry agent: one non-streaming call (can take 20–30 s). The full answer is
          // delivered as a single SSE token so the chat UI, memory layer and persistence are unchanged.
          const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(55_000)]);
          const result = await withRetry(() => callAgent(flattenForAgent(messages), { signal }), { attempts: 1 });
          usage = { prompt_tokens: result.inputTokens, completion_tokens: result.outputTokens };
          full = result.text;
          if (full) send('token', { t: full });
        }
        send('done', await finalize(false));
      } catch (err) {
        const code = mapOpenAiError(err);
        if (full) {
          const result = await finalize(true);
          send('error', { code: 'AI_UNAVAILABLE', message: 'Response interrupted.', partial: true, messageId: result.messageId });
        } else {
          await logUsage({
            userId: user.id,
            contractId,
            eventType: 'chat',
            model,
            promptVersion: CHAT_PROMPT_VERSION,
            promptTokens: 0,
            completionTokens: 0,
            latencyMs: Date.now() - t0,
            success: false,
            errorCode: code,
          });
          // Surface the real Azure error text so credential/endpoint problems can be diagnosed.
          send('error', { code, message: ERROR_CATALOG[code].message, detail: azureErrorDetail(err), userMessageId });
        }
        logger.error('chat.failed', { userId: user.id, contractId, code, partial: !!full, detail: azureErrorDetail(err) });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
