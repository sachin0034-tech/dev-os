import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid() });
export const contractTermParamSchema = z.object({
  id: z.string().uuid(),
  termId: z.string().uuid(),
});
