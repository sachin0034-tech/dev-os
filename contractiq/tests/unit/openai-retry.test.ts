// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { OPENAI_API_KEY: 'sk-test' } }));

const { withRetry, mapOpenAiError } = await import('@/lib/ai/openai-client');
const OpenAI = (await import('openai')).default;

const apiError = (status: number) => OpenAI.APIError.generate(status, { error: { message: 'x' } }, 'x', new Headers() as never);

describe('withRetry', () => {
  it('retries retryable errors up to 3 attempts', async () => {
    const fn = vi.fn().mockRejectedValueOnce(apiError(429)).mockRejectedValueOnce(apiError(503)).mockResolvedValue('ok');
    await expect(withRetry(fn, { baseMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 400', async () => {
    const fn = vi.fn().mockRejectedValue(apiError(400));
    await expect(withRetry(fn, { baseMs: 1 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after 3 attempts', async () => {
    const fn = vi.fn().mockRejectedValue(apiError(500));
    await expect(withRetry(fn, { baseMs: 1 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('mapOpenAiError', () => {
  it('maps errors to app codes', () => {
    expect(mapOpenAiError(apiError(429))).toBe('AI_UNAVAILABLE');
    expect(mapOpenAiError(apiError(400))).toBe('AI_INVALID_OUTPUT');
    const timeout = new Error('t');
    timeout.name = 'TimeoutError';
    expect(mapOpenAiError(timeout)).toBe('AI_TIMEOUT');
  });
});
