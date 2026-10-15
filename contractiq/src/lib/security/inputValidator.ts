import { LIMITS } from './tokenLimiter';

// Input validation — docs/security/security-plan.md §2 and §7.
// Client-safe (no server-only imports): used by the upload dropzone and by the API.

export { idParamSchema, contractTermParamSchema } from '@/lib/validation/common';
export { emailSchema, passwordSchema, signInSchema, signUpSchema, resendSchema } from '@/lib/validation/auth';
export {
  contractTypeSchema,
  initContractSchema,
  extractJsonSchema,
  listContractsQuerySchema,
  contractDetailQuerySchema,
} from '@/lib/validation/contracts';
export { customTermSchema, customTermNameSchema } from '@/lib/validation/custom-terms';
export { patchKeyTermSchema } from '@/lib/validation/key-terms';
export { chatPostSchema, chatHistoryQuerySchema } from '@/lib/validation/chat';
export { feedbackSchema } from '@/lib/validation/feedback';

/** Extensions that are never accepted, regardless of claimed MIME type. */
export const BLOCKED_EXTENSIONS = [
  'exe', 'js', 'mjs', 'cjs', 'php', 'zip', 'sh', 'bat', 'cmd', 'py', 'rb', 'ps1',
  'msi', 'jar', 'com', 'scr', 'vbs', 'html', 'htm', 'svg',
] as const;

/** ContractIQ processes text-based PDFs only (PRD §5); .docx is out of scope. */
export const ALLOWED_EXTENSIONS = ['pdf'] as const;
export const ALLOWED_MIME_TYPES = ['application/pdf'] as const;

export type FileValidationCode = 'BLOCKED_FILE_TYPE' | 'NOT_A_PDF' | 'FILE_TOO_LARGE' | 'EMPTY_FILE';

export type FileValidationResult = { ok: true } | { ok: false; code: FileValidationCode; message: string };

const extensionsOf = (name: string): string[] =>
  name
    .toLowerCase()
    .split('.')
    .slice(1)
    .map((e) => e.trim());

/**
 * Validates an upload in the required order:
 * 1. extension (blocklist, including double extensions like "x.pdf.exe" → allowlist)
 * 2. MIME type
 * 3. file size
 * Magic bytes (%PDF-) are verified server-side after upload.
 */
export function validateFileUpload(file: { name: string; type: string; size: number }): FileValidationResult {
  const exts = extensionsOf(file.name);
  const last = exts[exts.length - 1] ?? '';

  if (exts.some((e) => (BLOCKED_EXTENSIONS as readonly string[]).includes(e))) {
    return { ok: false, code: 'BLOCKED_FILE_TYPE', message: 'This file type is not allowed.' };
  }
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(last)) {
    return { ok: false, code: 'NOT_A_PDF', message: 'Only PDF files are supported.' };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, code: 'NOT_A_PDF', message: 'Only PDF files are supported.' };
  }
  if (file.size <= 0) return { ok: false, code: 'EMPTY_FILE', message: 'This file is empty.' };
  if (file.size > LIMITS.maxFileBytes) {
    return { ok: false, code: 'FILE_TOO_LARGE', message: 'PDF must be 10 MB or smaller.' };
  }
  return { ok: true };
}
