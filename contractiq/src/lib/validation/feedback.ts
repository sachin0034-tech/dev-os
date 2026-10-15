import { z } from 'zod';
import { MAX_FEEDBACK_COMMENT_CHARS } from '@/lib/constants/limits';

export const feedbackSchema = z.object({
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(MAX_FEEDBACK_COMMENT_CHARS, 'At most 1,000 characters'))
    .optional()
    .transform((s) => (s ? s : null)),
});
