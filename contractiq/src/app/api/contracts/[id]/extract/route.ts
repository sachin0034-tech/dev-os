import { AppError } from '@/lib/api/errors';
import { withHandler } from '@/lib/api/handler';
import { MAX_DIRECT_UPLOAD_BYTES } from '@/lib/constants/limits';
import { assertValidUpload, extractContract, type ExtractSource } from '@/lib/services/contracts.service';
import { idParamSchema } from '@/lib/validation/common';
import { extractJsonSchema } from '@/lib/validation/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// JSON { mode: 'storage' } reads the uploaded object; multipart `file` is the ≤ 4 MB fallback.
export const POST = withHandler({ params: idParamSchema }, async ({ req, params, supabase, user }) => {
  const contentType = req.headers.get('content-type') ?? '';
  let source: ExtractSource;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new AppError('VALIDATION_ERROR', { fieldErrors: { file: ['A PDF file is required'] } });
    }
    assertValidUpload({ name: file.name, type: file.type, size: file.size });
    if (file.size > MAX_DIRECT_UPLOAD_BYTES) throw new AppError('FILE_TOO_LARGE');
    source = { mode: 'direct', file: Buffer.from(await file.arrayBuffer()) };
  } else if (contentType.includes('application/json')) {
    extractJsonSchema.parse(await req.json().catch(() => ({})));
    source = { mode: 'storage' };
  } else {
    throw new AppError('VALIDATION_ERROR');
  }

  return extractContract(supabase, user, params.id, source);
});
