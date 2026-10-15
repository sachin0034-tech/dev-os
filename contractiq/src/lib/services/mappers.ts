import { STALE_PROCESSING_MS } from '@/lib/constants/limits';
import { confidenceBand } from '@/lib/utils/confidence';
import { toTermKey } from '@/lib/utils/slug';
import type { Tables, Views } from '@/types/database.types';
import type {
  ChatMessage,
  ContractDetail,
  ContractStatus,
  ContractSummary,
  CustomTerm,
  KeyTerm,
} from '@/types/api';

// The only place DB rows (snake_case) become API objects (camelCase).

export const isStaleProcessing = (status: string | null, startedAt: string | null): boolean =>
  status === 'processing' &&
  (!startedAt || Date.now() - new Date(startedAt).getTime() > STALE_PROCESSING_MS);

const effectiveStatus = (status: ContractStatus, startedAt: string | null): ContractStatus =>
  isStaleProcessing(status, startedAt) ? 'error' : status;

export function toContractSummary(
  row: Views<'contract_list_items'> | Tables<'contracts'>,
  lowConfidenceCount = 0,
): ContractSummary {
  const status = row.status as ContractStatus;
  return {
    id: row.id!,
    fileName: row.file_name!,
    contractType: row.contract_type!,
    status: effectiveStatus(status, row.processing_started_at),
    pageCount: row.page_count,
    createdAt: row.created_at!,
    processingCompletedAt: row.processing_completed_at,
    lowConfidenceCount:
      'low_confidence_count' in row ? (row.low_confidence_count ?? 0) : lowConfidenceCount,
  };
}

export function toContractDetail(row: Tables<'contracts'>, lowConfidenceCount: number): ContractDetail {
  const stale = isStaleProcessing(row.status, row.processing_started_at);
  return {
    ...toContractSummary(row, lowConfidenceCount),
    hasPdf: row.file_path !== null,
    pdfDeletedAt: row.pdf_deleted_at,
    errorCode: stale ? 'STALE_PROCESSING' : row.error_code,
    errorMessage: stale ? 'Analysis was interrupted. Try again.' : row.error_message,
    promptVersion: row.prompt_version,
    wordCount: row.word_count,
    tokenCount: row.token_count,
  };
}

export function toKeyTerm(row: Tables<'key_terms'>): KeyTerm {
  return {
    id: row.id,
    termKey: row.term_key,
    termName: row.term_name,
    value: row.value,
    originalValue: row.original_value,
    pageNumber: row.page_number,
    confidenceScore: row.confidence_score,
    confidenceBand: confidenceBand(row.confidence_score),
    sourceSentence: row.source_sentence,
    isCustom: row.is_custom,
    isEdited: row.is_edited,
    editedAt: row.edited_at,
    flags: row.validation_flags,
  };
}

export function toCustomTerm(row: Pick<Tables<'custom_key_terms'>, 'id' | 'term_name'>): CustomTerm {
  return { id: row.id, termName: row.term_name, termKey: toTermKey(row.term_name, true) };
}

export function toChatMessage(row: Tables<'chat_messages'>): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    queryType:
      row.query_type === 'contract' || row.query_type === 'history' || row.query_type === 'both'
        ? row.query_type
        : null,
    citedPages: row.cited_pages,
    missingCitation: row.missing_citation,
    isPartial: row.is_partial,
    createdAt: row.created_at,
  };
}

export const KEY_TERM_COLUMNS =
  'id, contract_id, user_id, term_name, term_key, value, original_value, page_number, confidence_score, source_sentence, is_custom, is_edited, edited_at, display_order, validation_flags, created_at, updated_at';
