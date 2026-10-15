import { z } from 'zod';
import { MAX_TERM_VALUE_CHARS } from '@/lib/constants/limits';

export const patchKeyTermSchema = z.union([
  z.object({ value: z.string().max(MAX_TERM_VALUE_CHARS, 'At most 2,000 characters') }).strict(),
  z.object({ revert: z.literal(true) }).strict(),
]);
export type PatchKeyTerm = z.infer<typeof patchKeyTermSchema>;
