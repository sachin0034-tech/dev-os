import 'server-only';
import type OpenAI from 'openai';
import { buildExtractionMessages, EXTRACTION_PROMPT_VERSION } from '@/lib/ai/prompts/extraction/v1';
import type { RequestedTerm } from '@/lib/ai/prompts/extraction/types';
import { mockExtraction } from '@/lib/ai/mock';
import { mapOpenAiError, withRetry } from '@/lib/ai/openai-client';
import { agentModelLabel, azureErrorDetail, callAgent, extractJsonObject, flattenForAgent } from '@/lib/azure';
import { extractionOutputSchema, type ExtractionOutput } from '@/lib/ai/schemas';
import { validateTerms } from '@/lib/ai/validate-terms';
import { AppError, ERROR_CATALOG, mapPgError, type ErrorCode } from '@/lib/api/errors';
import type { AuthUser } from '@/lib/api/handler';
import { STALE_PROCESSING_MS } from '@/lib/constants/limits';
import { STANDARD_TERMS } from '@/lib/constants/standard-terms';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerSupabase } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { toTermKey } from '@/lib/utils/slug';
import type { KeyTerm } from '@/types/api';
import { isStaleProcessing, KEY_TERM_COLUMNS, toKeyTerm } from './mappers';
import { detectPromptInjection, neutralizeContractText } from '@/lib/security/promptInjectionGuard';
import { assertQuota, logUsage } from './usage.service';

type ChatMessages = OpenAI.Chat.Completions.ChatCompletionMessageParam[];

export interface ProcessResult {
  contractId: string;
  status: 'completed';
  processingMs: number;
  keyTerms: KeyTerm[];
}

interface Usage {
  prompt: number;
  completion: number;
}

const REPAIR_PROMPT =
  'Your previous reply was not a valid JSON object of the required shape. Reply again with ONLY the JSON object.';

function parseOutput(text: string): ExtractionOutput | null {
  try {
    const parsed = extractionOutputSchema.safeParse(extractJsonObject(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// One agent call. The agent can take 20–30 s; two attempts fit inside the 90 s route budget.
async function callModel(messages: ChatMessages, usage: Usage): Promise<string> {
  const result = await withRetry(() => callAgent(flattenForAgent(messages), { signal: AbortSignal.timeout(40_000) }), {
    attempts: 2,
  });
  usage.prompt += result.inputTokens;
  usage.completion += result.outputTokens;
  return result.text;
}

// Runs AI extraction for one contract — docs/specs/ai-extraction-pipeline.md §3.
export async function processContract(
  supabase: ServerSupabase,
  user: AuthUser,
  id: string,
): Promise<ProcessResult> {
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, status, processing_started_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapPgError(error);
  if (!contract) throw new AppError('NOT_FOUND');
  if (contract.status === 'uploading' || contract.status === 'completed') throw new AppError('INVALID_STATE');
  if (contract.status === 'processing' && !isStaleProcessing(contract.status, contract.processing_started_at)) {
    throw new AppError('ALREADY_PROCESSING');
  }

  await assertQuota(user.id);

  // Atomic claim: only one request can move the contract into `processing`.
  const admin = createAdminClient();
  const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const { data: claimed, error: claimError } = await admin
    .from('contracts')
    .update({
      status: 'processing',
      processing_started_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .or(`status.in.(ready,error),and(status.eq.processing,processing_started_at.lt.${staleCutoff})`)
    .select('id, contract_text, contract_type, page_count')
    .maybeSingle();
  if (claimError) throw mapPgError(claimError);
  if (!claimed) throw new AppError('ALREADY_PROCESSING');

  const t0 = Date.now();
  const usage: Usage = { prompt: 0, completion: 0 };
  const model = env.AI_MOCK_MODE ? 'mock' : agentModelLabel();

  try {
    const { data: custom, error: customError } = await supabase
      .from('custom_key_terms')
      .select('term_name')
      .eq('contract_id', id)
      .order('created_at');
    if (customError) throw mapPgError(customError);

    const requested: RequestedTerm[] = [
      ...STANDARD_TERMS[claimed.contract_type].map((t, i) => ({
        key: t.key,
        name: t.name,
        definition: t.definition,
        custom: false,
        order: i + 1,
      })),
      ...(custom ?? []).filter((c) => !detectPromptInjection(c.term_name).detected).map((c, i) => ({
        key: toTermKey(c.term_name, true),
        name: c.term_name,
        definition: null,
        custom: true,
        order: 100 + i + 1,
      })),
    ];
    const contractText = neutralizeContractText(claimed.contract_text ?? '');

    let output: ExtractionOutput | null;
    if (env.AI_MOCK_MODE) {
      output = await mockExtraction(requested, contractText);
    } else {
      const messages = buildExtractionMessages({
        contractType: claimed.contract_type,
        requested,
        contractText,
      });
      const first = await callModel(messages, usage);
      output = parseOutput(first);
      if (!output) {
        const repaired = await callModel(
          [...messages, { role: 'assistant', content: first }, { role: 'user', content: REPAIR_PROMPT }],
          usage,
        );
        output = parseOutput(repaired);
      }
    }
    if (!output) throw new AppError('AI_INVALID_OUTPUT');

    const { terms, droppedUnknown } = validateTerms(output.terms, {
      requested,
      contractText,
      pageCount: claimed.page_count ?? 1,
    });

    const { error: rpcError } = await admin.rpc('replace_key_terms', {
      p_contract_id: id,
      p_user_id: user.id,
      p_terms: terms as never,
    });
    if (rpcError) throw mapPgError(rpcError);

    const processingMs = Date.now() - t0;
    const { error: doneError } = await admin
      .from('contracts')
      .update({
        status: 'completed',
        processing_completed_at: new Date().toISOString(),
        processing_ms: processingMs,
        prompt_version: EXTRACTION_PROMPT_VERSION,
      })
      .eq('id', id);
    if (doneError) throw mapPgError(doneError);

    await logUsage({
      userId: user.id,
      contractId: id,
      eventType: 'extraction',
      model,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      promptTokens: usage.prompt,
      completionTokens: usage.completion,
      latencyMs: processingMs,
      success: true,
    });
    logger.info('extraction.completed', {
      userId: user.id,
      contractId: id,
      terms: terms.length,
      droppedUnknown,
      promptTokens: usage.prompt,
      completionTokens: usage.completion,
      latencyMs: processingMs,
      promptVersion: EXTRACTION_PROMPT_VERSION,
    });

    const { data: rows, error: readError } = await supabase
      .from('key_terms')
      .select(KEY_TERM_COLUMNS)
      .eq('contract_id', id)
      .order('display_order');
    if (readError) throw mapPgError(readError);

    return { contractId: id, status: 'completed', processingMs, keyTerms: (rows ?? []).map(toKeyTerm) };
  } catch (err) {
    const code: ErrorCode = err instanceof AppError ? err.code : mapOpenAiError(err);
    await admin
      .from('contracts')
      .update({ status: 'error', error_code: code, error_message: ERROR_CATALOG[code].message })
      .eq('id', id)
      .eq('status', 'processing');
    await logUsage({
      userId: user.id,
      contractId: id,
      eventType: 'extraction',
      model,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      promptTokens: usage.prompt,
      completionTokens: usage.completion,
      latencyMs: Date.now() - t0,
      success: false,
      errorCode: code,
    });
    const detail = err instanceof AppError ? undefined : azureErrorDetail(err);
    logger.error('extraction.failed', { userId: user.id, contractId: id, code, detail });
    throw err instanceof AppError ? err : new AppError(code, { detail }, { cause: err });
  }
}
