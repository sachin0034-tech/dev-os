import 'server-only';
import { AppError, mapPgError } from '@/lib/api/errors';
import type { AuthUser } from '@/lib/api/handler';
import { STANDARD_TERMS } from '@/lib/constants/standard-terms';
import type { ServerSupabase } from '@/lib/supabase/server';
import type { CustomTerm } from '@/types/api';
import { sanitizeForLLM } from '@/lib/security/promptInjectionGuard';
import { toCustomTerm } from './mappers';

const EDITABLE_STATUSES = new Set(['uploading', 'ready']);

async function loadEditableContract(supabase: ServerSupabase, id: string) {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, status, contract_type')
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapPgError(error);
  if (!data) throw new AppError('NOT_FOUND');
  if (!EDITABLE_STATUSES.has(data.status)) throw new AppError('INVALID_STATE');
  return data;
}

// docs/specs/custom-key-terms.md §6
export async function addCustomTerm(
  supabase: ServerSupabase,
  user: AuthUser,
  contractId: string,
  termName: string,
): Promise<CustomTerm> {
  sanitizeForLLM(termName, { userId: user.id, field: 'custom_term' });
  const contract = await loadEditableContract(supabase, contractId);
  const lower = termName.toLowerCase();
  if (STANDARD_TERMS[contract.contract_type].some((t) => t.name.toLowerCase() === lower)) {
    throw new AppError('CUSTOM_TERM_DUPLICATE');
  }

  const { data, error } = await supabase
    .from('custom_key_terms')
    .insert({ contract_id: contractId, user_id: user.id, term_name: termName })
    .select('id, term_name')
    .single();
  if (error || !data) throw mapPgError(error);
  return toCustomTerm(data);
}

export async function removeCustomTerm(
  supabase: ServerSupabase,
  contractId: string,
  termId: string,
): Promise<void> {
  await loadEditableContract(supabase, contractId);
  const { data, error } = await supabase
    .from('custom_key_terms')
    .delete()
    .eq('id', termId)
    .eq('contract_id', contractId)
    .select('id');
  if (error) throw mapPgError(error);
  if (!data || data.length === 0) throw new AppError('NOT_FOUND');
}
