import 'server-only';
// Retry + error mapping for AI calls. The provider is the Azure AI Foundry agent (lib/azure.ts);
// it uses the `openai` SDK, so its errors are OpenAI.APIError instances.
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import type { ErrorCode } from '@/lib/api/errors';

// Stable, non-reversible user id for OpenAI abuse monitoring (no PII sent).
export const hashUserId = (id: string) => createHash('sha256').update(id).digest('hex').slice(0, 32);

const isTimeout = (err: unknown) =>
  err instanceof OpenAI.APIConnectionTimeoutError ||
  (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError'));

export function isRetryable(err: unknown): boolean {
  if (isTimeout(err) || err instanceof OpenAI.APIConnectionError) return true;
  if (err instanceof OpenAI.APIError) {
    const s = err.status ?? 0;
    return s === 408 || s === 409 || s === 429 || s >= 500;
  }
  return false;
}

export function mapOpenAiError(err: unknown): ErrorCode {
  if (isTimeout(err)) return 'AI_TIMEOUT';
  if (err instanceof OpenAI.APIConnectionError) return 'AI_UNAVAILABLE';
  if (err instanceof OpenAI.APIError) {
    const s = err.status ?? 0;
    if (s === 429 || s >= 500 || s === 408 || s === 409) return 'AI_UNAVAILABLE';
  }
  return 'AI_INVALID_OUTPUT';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryAfterMs(err: unknown): number | null {
  if (!(err instanceof OpenAI.APIError) || !err.headers) return null;
  const ms = Number(err.headers['retry-after-ms']);
  if (Number.isFinite(ms) && ms > 0) return ms;
  const s = Number(err.headers['retry-after']);
  return Number.isFinite(s) && s > 0 ? s * 1000 : null;
}

// Exponential backoff with jitter: 1s, 2s (+0–250ms), honouring Retry-After (capped at 8s).
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  { attempts = 3, baseMs = 1000 }: { attempts?: number; baseMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !isRetryable(err)) throw err;
      const delay = Math.min(retryAfterMs(err) ?? baseMs * 2 ** (attempt - 1) + Math.random() * 250, 8000);
      await sleep(delay);
    }
  }
  throw lastErr;
}
