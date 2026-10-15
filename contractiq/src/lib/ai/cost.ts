import 'server-only';
import { env } from '@/lib/env';

// USD cost of one OpenAI call, from configurable per-1M-token prices.
export const calcCostUsd = (promptTokens: number, completionTokens: number): number =>
  Number(
    (
      (promptTokens * env.AI_PRICE_INPUT_PER_1M +
        completionTokens * env.AI_PRICE_OUTPUT_PER_1M) /
      1_000_000
    ).toFixed(6),
  );
