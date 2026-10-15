import { withHandler } from '@/lib/api/handler';
import { removeCustomTerm } from '@/lib/services/custom-terms.service';
import { contractTermParamSchema } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withHandler({ params: contractTermParamSchema }, async ({ params, supabase }) => {
  await removeCustomTerm(supabase, params.id, params.termId);
  return new Response(null, { status: 204 });
});
