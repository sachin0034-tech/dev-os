import { withHandler } from '@/lib/api/handler';
import { addCustomTerm } from '@/lib/services/custom-terms.service';
import { idParamSchema } from '@/lib/validation/common';
import { customTermSchema } from '@/lib/validation/custom-terms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(
  { params: idParamSchema, body: customTermSchema },
  async ({ params, body, supabase, user }) => {
    const term = await addCustomTerm(supabase, user, params.id, body.termName);
    return Response.json(term, { status: 201 });
  },
);
