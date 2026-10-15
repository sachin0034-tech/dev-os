import { AppError } from '@/lib/api/errors';
import { withHandler } from '@/lib/api/handler';
import { deleteContract, getContractDetail } from '@/lib/services/contracts.service';
import { idParamSchema } from '@/lib/validation/common';
import { contractDetailQuerySchema } from '@/lib/validation/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(
  { params: idParamSchema, query: contractDetailQuerySchema },
  async ({ params, query, supabase }) => {
    const detail = await getContractDetail(supabase, params.id, { includeText: query.include === 'text' });
    if (!detail) throw new AppError('NOT_FOUND');
    return detail;
  },
);

export const DELETE = withHandler({ params: idParamSchema }, async ({ params, supabase }) => {
  await deleteContract(supabase, params.id);
  return new Response(null, { status: 204 });
});
