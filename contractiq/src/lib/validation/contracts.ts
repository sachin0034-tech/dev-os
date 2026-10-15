import { z } from 'zod';
import { MAX_FILE_BYTES } from '@/lib/constants/limits';

export const contractTypeSchema = z.enum(['NDA', 'MSA']);

export const initContractSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((n) => /\.pdf$/i.test(n), 'Must be a .pdf file'),
  fileSize: z.number().int().positive(),
  mimeType: z.string().trim().max(100),
  contractType: contractTypeSchema,
});

export const extractJsonSchema = z.object({ mode: z.literal('storage') });

export const listContractsQuerySchema = z.object({
  sort: z.enum(['created_at', 'file_name', 'contract_type', 'status']).catch('created_at'),
  dir: z.enum(['asc', 'desc']).catch('desc'),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(20),
});
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;

export const contractDetailQuerySchema = z.object({ include: z.literal('text').optional() });

export const sanitizeFileName = (name: string): string =>
  name
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'contract.pdf';

export const isOverMaxFileSize = (bytes: number) => bytes > MAX_FILE_BYTES;
