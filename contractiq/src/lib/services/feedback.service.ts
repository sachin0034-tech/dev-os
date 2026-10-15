import 'server-only';
import { AppError, mapPgError } from '@/lib/api/errors';
import type { AuthUser } from '@/lib/api/handler';
import type { ServerSupabase } from '@/lib/supabase/server';

// One feedback row per user per contract — docs/specs/feedback.md §4.
export async function upsertFeedback(
  supabase: ServerSupabase,
  user: AuthUser,
  contractId: string,
  input: { rating: 1 | -1; comment: string | null },
) {
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, status')
    .eq('id', contractId)
    .maybeSingle();
  if (error) throw mapPgError(error);
  if (!contract) throw new AppError('NOT_FOUND');
  if (contract.status !== 'completed') throw new AppError('INVALID_STATE');

  const { data, error: upsertError } = await supabase
    .from('user_feedback')
    .upsert(
      { contract_id: contractId, user_id: user.id, rating: input.rating, comment: input.comment },
      { onConflict: 'contract_id,user_id' },
    )
    .select('rating, comment, updated_at')
    .single();
  if (upsertError || !data) throw mapPgError(upsertError);
  return { rating: data.rating === 1 ? 1 : -1, comment: data.comment, updatedAt: data.updated_at };
}
