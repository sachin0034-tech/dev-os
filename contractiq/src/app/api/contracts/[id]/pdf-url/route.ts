import { AppError, mapPgError } from '@/lib/api/errors';
import { withHandler } from '@/lib/api/handler';
import { SIGNED_URL_TTL_SECONDS } from '@/lib/constants/limits';
import { createViewUrl } from '@/lib/services/storage.service';
import { idParamSchema } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1-hour signed URL for the PDF viewer — docs/specs/contract-viewer.md §3.
export const GET = withHandler({ params: idParamSchema }, async ({ params, supabase }) => {
  const { data, error } = await supabase.from('contracts').select('file_path').eq('id', params.id).maybeSingle();
  if (error) throw mapPgError(error);
  if (!data) throw new AppError('NOT_FOUND');
  if (!data.file_path) throw new AppError('PDF_UNAVAILABLE');

  const url = await createViewUrl(data.file_path);
  return { url, expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString() };
});
