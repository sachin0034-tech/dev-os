import 'server-only';
import { AppError } from '@/lib/api/errors';
import { SIGNED_URL_TTL_SECONDS } from '@/lib/constants/limits';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

const BUCKET = 'contracts';

export const contractPdfPath = (userId: string, contractId: string) =>
  `${userId}/${contractId}/source.pdf`;

const isNotFound = (err: { message?: string; statusCode?: string | number } | null) =>
  !!err && (String(err.statusCode) === '404' || /not found/i.test(err.message ?? ''));

export async function createUploadUrl(path: string): Promise<string | null> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path, {
    upsert: true,
  });
  if (error || !data) {
    logger.warn('storage.upload_url_failed', { path, message: error?.message });
    return null;
  }
  return data.token;
}

export async function downloadPdf(path: string): Promise<Buffer> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(path);
  if (error || !data) {
    throw new AppError(isNotFound(error as never) ? 'UPLOAD_MISSING' : 'STORAGE_UNAVAILABLE', undefined, {
      cause: error,
    });
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function createViewUrl(path: string): Promise<string> {
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    throw new AppError(isNotFound(error as never) ? 'PDF_UNAVAILABLE' : 'STORAGE_UNAVAILABLE', undefined, {
      cause: error,
    });
  }
  return data.signedUrl;
}

// Best-effort removal; failures are logged as orphans for manual cleanup.
export async function removePdfs(paths: string[]): Promise<boolean> {
  if (paths.length === 0) return true;
  const { error } = await createAdminClient().storage.from(BUCKET).remove(paths);
  if (error) {
    logger.error('storage.orphan', { paths, message: error.message });
    return false;
  }
  return true;
}
