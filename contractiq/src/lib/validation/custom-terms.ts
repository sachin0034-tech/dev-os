import { z } from 'zod';
import { CUSTOM_TERM_MAX, CUSTOM_TERM_MIN } from '@/lib/constants/limits';

export const customTermNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(CUSTOM_TERM_MIN, 'At least 2 characters')
      .max(CUSTOM_TERM_MAX, 'At most 80 characters')
      .regex(/^[\p{L}\p{N} &\-'/()]+$/u, "Use letters, numbers, spaces and & - ' / ( ) only"),
  );

export const customTermSchema = z.object({ termName: customTermNameSchema });
