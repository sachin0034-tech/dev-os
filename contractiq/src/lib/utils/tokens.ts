import 'server-only';
import { getEncoding, type Tiktoken } from 'js-tiktoken';

// GPT-4o tokenizer (o200k_base), created once per serverless instance.
let encoder: Tiktoken | undefined;

export function countTokens(text: string): number {
  encoder ??= getEncoding('o200k_base');
  return encoder.encode(text).length;
}
