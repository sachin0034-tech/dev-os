import { withHandler } from '@/lib/api/handler';
import { updateKeyTerm } from '@/lib/services/key-terms.service';
import { idParamSchema } from '@/lib/validation/common';
import { patchKeyTermSchema } from '@/lib/validation/key-terms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = withHandler(
  { params: idParamSchema, body: patchKeyTermSchema, rateLimit: 'key_term_edit' },
  async ({ params, body, supabase }) => updateKeyTerm(supabase, params.id, body),
);
