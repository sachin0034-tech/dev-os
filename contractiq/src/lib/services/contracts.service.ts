import 'server-only';
import { AppError, mapPgError, type ErrorCode } from '@/lib/api/errors';
import {
  MAX_CONTRACT_TOKENS,
  MAX_DIRECT_UPLOAD_BYTES,
  MAX_FILE_BYTES,
  MAX_PAGES,
  MIN_WORDS,
} from '@/lib/constants/limits';
import { STANDARD_TERMS, type TermDefinition } from '@/lib/constants/standard-terms';
import { extractPdfText } from '@/lib/pdf/extract-text';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerSupabase } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { countTokens } from '@/lib/utils/tokens';
import { sanitizeFileName, type ListContractsQuery } from '@/lib/validation/contracts';
import type {
  ContractDetail,
  ContractDetailResponse,
  ContractListResponse,
  ContractType,
} from '@/types/api';
import type { AuthUser } from '@/lib/api/handler';
import {
  isStaleProcessing,
  KEY_TERM_COLUMNS,
  toContractDetail,
  toContractSummary,
  toCustomTerm,
  toKeyTerm,
} from './mappers';
import { contractPdfPath, createUploadUrl, downloadPdf, removePdfs } from './storage.service';
import { validateFileUpload } from '@/lib/security/inputValidator';
import { audit } from '@/lib/security/auditLog';
import { assertQuota } from './usage.service';

// ---------------------------------------------------------------------------
// Upload & extraction — docs/specs/contract-upload-and-extraction.md
// ---------------------------------------------------------------------------

/** Extension → MIME → size, in that order (docs/security/security-plan.md §7). */
export function assertValidUpload(file: { name: string; type: string; size: number }): void {
  const result = validateFileUpload(file);
  if (!result.ok) {
    throw new AppError(result.code === 'FILE_TOO_LARGE' ? 'FILE_TOO_LARGE' : result.code === 'EMPTY_FILE' ? 'VALIDATION_ERROR' : 'NOT_A_PDF');
  }
}

export interface InitContractResult {
  contractId: string;
  storagePath: string;
  uploadToken: string | null;
  maxDirectUploadBytes: number;
}

export async function initContract(
  user: AuthUser,
  input: { fileName: string; fileSize: number; mimeType: string; contractType: ContractType },
): Promise<InitContractResult> {
  assertValidUpload({ name: input.fileName, type: input.mimeType, size: input.fileSize });
  await assertQuota(user.id);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('contracts')
    .insert({
      user_id: user.id,
      file_name: sanitizeFileName(input.fileName),
      file_size_bytes: input.fileSize,
      contract_type: input.contractType,
      status: 'uploading',
    })
    .select('id')
    .single();
  if (error || !data) throw mapPgError(error);

  const storagePath = contractPdfPath(user.id, data.id);
  const uploadToken = await createUploadUrl(storagePath);
  return { contractId: data.id, storagePath, uploadToken, maxDirectUploadBytes: MAX_DIRECT_UPLOAD_BYTES };
}

export type ExtractSource = { mode: 'storage' } | { mode: 'direct'; file: Buffer };

export interface ExtractContractResult {
  contract: ContractDetail;
  standardTerms: TermDefinition[];
}

export async function extractContract(
  supabase: ServerSupabase,
  user: AuthUser,
  id: string,
  source: ExtractSource,
): Promise<ExtractContractResult> {
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, status, contract_type')
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapPgError(error);
  if (!contract) throw new AppError('NOT_FOUND');
  if (contract.status !== 'uploading') throw new AppError('INVALID_STATE');

  const path = contractPdfPath(user.id, id);
  // UPLOAD_MISSING / STORAGE_UNAVAILABLE propagate without deleting the row so the client can retry.
  const buffer = source.mode === 'storage' ? await downloadPdf(path) : source.file;

  const admin = createAdminClient();
  const reject = async (code: ErrorCode): Promise<never> => {
    await removePdfs([path]);
    await admin.from('contracts').delete().eq('id', id);
    logger.info('contract.extract_rejected', { userId: user.id, contractId: id, code });
    throw new AppError(code);
  };

  if (buffer.byteLength > MAX_FILE_BYTES) return reject('FILE_TOO_LARGE');
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') return reject('NOT_A_PDF');

  let extracted;
  try {
    extracted = await extractPdfText(buffer, { maxPages: MAX_PAGES });
  } catch (err) {
    const cause = err instanceof AppError ? err.cause : err;
    logger.warn('contract.pdf_parse_failed', {
      contractId: id,
      error: cause instanceof Error ? `${cause.name}: ${cause.message}`.slice(0, 300) : String(cause).slice(0, 300),
    });
    return reject('PDF_UNREADABLE');
  }
  if (extracted.pageCount > MAX_PAGES) return reject('TOO_MANY_PAGES');
  if (extracted.wordCount < MIN_WORDS) return reject('SCANNED_PDF');
  const tokenCount = countTokens(extracted.text);
  if (tokenCount > MAX_CONTRACT_TOKENS) return reject('CONTRACT_TOO_LONG');

  const { data: updated, error: updateError } = await admin
    .from('contracts')
    .update({
      contract_text: extracted.text,
      page_count: extracted.pageCount,
      word_count: extracted.wordCount,
      token_count: tokenCount,
      file_path: source.mode === 'storage' ? path : null,
      status: 'ready',
    })
    .eq('id', id)
    .eq('status', 'uploading')
    .select('*')
    .maybeSingle();
  if (updateError) throw mapPgError(updateError);
  if (!updated) throw new AppError('INVALID_STATE');

  logger.info('contract.extracted', {
    userId: user.id,
    contractId: id,
    pages: extracted.pageCount,
    tokens: tokenCount,
    mode: source.mode,
  });
  return {
    contract: toContractDetail(updated, 0),
    standardTerms: STANDARD_TERMS[updated.contract_type],
  };
}

// ---------------------------------------------------------------------------
// Read — docs/specs/results-page-and-key-terms.md §4, dashboard.md §4
// ---------------------------------------------------------------------------

export async function getContractDetail(
  supabase: ServerSupabase,
  id: string,
  opts: { includeText?: boolean; touch?: boolean } = {},
): Promise<ContractDetailResponse | null> {
  const { data: contract, error } = await supabase.from('contracts').select('*').eq('id', id).maybeSingle();
  if (error) throw mapPgError(error);
  if (!contract || contract.status === 'uploading') return null;

  const [terms, custom, feedback] = await Promise.all([
    supabase.from('key_terms').select(KEY_TERM_COLUMNS).eq('contract_id', id).order('display_order'),
    supabase.from('custom_key_terms').select('id, term_name').eq('contract_id', id).order('created_at'),
    supabase.from('user_feedback').select('rating, comment').eq('contract_id', id).maybeSingle(),
  ]);
  if (terms.error) throw mapPgError(terms.error);
  if (custom.error) throw mapPgError(custom.error);

  if (opts.touch !== false) {
    // Resets the 90-day PDF retention clock; failures are non-fatal.
    void supabase
      .from('contracts')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', id)
      .then(({ error: touchError }) => {
        if (touchError) logger.warn('contract.touch_failed', { contractId: id, code: touchError.code });
      });
  }

  const keyTerms = (terms.data ?? []).map(toKeyTerm);
  const lowConfidence = keyTerms.filter((t) => t.confidenceScore < 50).length;
  return {
    contract: toContractDetail(contract, lowConfidence),
    keyTerms,
    customTerms: (custom.data ?? []).map(toCustomTerm),
    feedback: feedback.data
      ? { rating: feedback.data.rating === 1 ? 1 : -1, comment: feedback.data.comment }
      : null,
    ...(opts.includeText ? { contractText: contract.contract_text ?? '' } : {}),
  };
}

export async function getContractForResume(supabase: ServerSupabase, id: string) {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapPgError(error);
  return data;
}

export async function listContracts(
  supabase: ServerSupabase,
  q: ListContractsQuery,
): Promise<ContractListResponse> {
  const from = (q.page - 1) * q.pageSize;
  const [list, all] = await Promise.all([
    supabase
      .from('contract_list_items')
      .select('*', { count: 'exact' })
      .order(q.sort, { ascending: q.dir === 'asc' })
      .order('id', { ascending: true })
      .range(from, from + q.pageSize - 1),
    supabase.from('contract_list_items').select('contract_type, status'),
  ]);
  if (list.error) throw mapPgError(list.error);
  if (all.error) throw mapPgError(all.error);

  const completed = (all.data ?? []).filter((r) => r.status === 'completed');
  return {
    items: (list.data ?? []).map((row) => toContractSummary(row)),
    total: list.count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
    summary: {
      total: completed.length,
      nda: completed.filter((r) => r.contract_type === 'NDA').length,
      msa: completed.filter((r) => r.contract_type === 'MSA').length,
    },
  };
}

// ---------------------------------------------------------------------------
// Delete — docs/specs/retention-and-deletion.md §3
// ---------------------------------------------------------------------------

export async function deleteContract(supabase: ServerSupabase, id: string): Promise<void> {
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, status, file_path, processing_started_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapPgError(error);
  if (!contract) throw new AppError('NOT_FOUND');
  if (contract.status === 'processing' && !isStaleProcessing(contract.status, contract.processing_started_at)) {
    throw new AppError('INVALID_STATE');
  }

  if (contract.file_path) await removePdfs([contract.file_path]);

  const { error: deleteError } = await supabase.from('contracts').delete().eq('id', id);
  if (deleteError) throw mapPgError(deleteError);
  audit('contract.deleted', { contractId: id });
}
