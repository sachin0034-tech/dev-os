import { z } from 'zod';
import { MAX_CHAT_MESSAGE_CHARS } from '@/lib/constants/limits';

export const chatPostSchema = z.object({
  message: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Type a question').max(MAX_CHAT_MESSAGE_CHARS, 'At most 2,000 characters')),
  retryOfMessageId: z.string().uuid().optional(),
});

export const chatHistoryQuerySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).catch(200),
});
