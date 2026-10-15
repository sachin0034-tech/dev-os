import 'server-only';
import { AppError, mapPgError } from '@/lib/api/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerSupabase } from '@/lib/supabase/server';

// Chat ownership checks — docs/security/security-plan.md §6.
// Both checks run before every chat request. They are explicit (user_id === caller) on top
// of RLS, so a policy mistake can't silently expose another user's contract or session.

export async function verifyContractOwnership(
  supabase: ServerSupabase,
  contractId: string,
  userId: string,
  opts: { requireCompleted?: boolean } = {},
) {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, user_id, status, contract_type, contract_text, page_count')
    .eq('id', contractId)
    .maybeSingle();
  if (error) throw mapPgError(error);
  if (!data || data.user_id !== userId) throw new AppError('NOT_FOUND');
  if (opts.requireCompleted && (data.status !== 'completed' || !data.contract_text)) {
    throw new AppError('CHAT_NOT_READY');
  }
  return data;
}

/** Returns the caller's session for the contract (creating it if needed) after verifying ownership. */
export async function verifySessionOwnership(
  supabase: ServerSupabase,
  contractId: string,
  userId: string,
  opts: { create?: boolean } = {},
): Promise<{ id: string } | null> {
  if (opts.create) {
    // Unique contract_id makes this safe under concurrent first messages. The contract's
    // ownership has already been verified by verifyContractOwnership.
    await createAdminClient()
      .from('chat_sessions')
      .upsert({ contract_id: contractId, user_id: userId }, { onConflict: 'contract_id', ignoreDuplicates: true });
  }
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, user_id')
    .eq('contract_id', contractId)
    .maybeSingle();
  if (error) throw mapPgError(error);
  if (!data) {
    if (opts.create) throw new AppError('INTERNAL');
    return null;
  }
  if (data.user_id !== userId) throw new AppError('NOT_FOUND');
  return { id: data.id };
}
