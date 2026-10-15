import { withHandler } from '@/lib/api/handler';
import { initContract } from '@/lib/services/contracts.service';
import { initContractSchema } from '@/lib/validation/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(
  { body: initContractSchema, rateLimit: 'upload' },
  async ({ user, body }) => {
    const result = await initContract(user, body);
    return Response.json(result, { status: 201 });
  },
);
