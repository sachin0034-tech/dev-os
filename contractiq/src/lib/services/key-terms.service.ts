import 'server-only';
import { AppError, mapPgError } from '@/lib/api/errors';
import type { ServerSupabase } from '@/lib/supabase/server';
import type { PatchKeyTerm } from '@/lib/validation/key-terms';
import type { KeyTerm } from '@/types/api';
import { KEY_TERM_COLUMNS, toKeyTerm } from './mappers';

// Edit or revert a key term's value — docs/specs/key-term-editing.md §4.
// Uses the user-scoped client: RLS + column grants allow only value/is_edited/edited_at.
export async function updateKeyTerm(supabase: ServerSupabase, id: string, body: PatchKeyTerm): Promise<KeyTerm> {
  const { data: current, error } = await supabase
    .from('key_terms')
    .select(KEY_TERM_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapPgError(error);
  if (!current) throw new AppError('NOT_FOUND');

  let patch: { value: string | null; is_edited: boolean; edited_at: string | null };
  if ('revert' in body) {
    patch = { value: current.original_value, is_edited: false, edited_at: null };
  } else {
    const next = body.value.trim() || null;
    if (next === current.value) return toKeyTerm(current);
    const edited = next !== current.original_value;
    patch = { value: next, is_edited: edited, edited_at: edited ? new Date().toISOString() : null };
  }

  const { data, error: updateError } = await supabase
    .from('key_terms')
    .update(patch)
    .eq('id', id)
    .select(KEY_TERM_COLUMNS)
    .single();
  if (updateError || !data) throw mapPgError(updateError);
  return toKeyTerm(data);
}
