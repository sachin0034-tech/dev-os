import { withHandler } from '@/lib/api/handler';
import { processContract } from '@/lib/services/extraction.service';
import { idParamSchema } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

export const POST = withHandler({ params: idParamSchema, rateLimit: 'process' }, async ({ params, supabase, user }) =>
  processContract(supabase, user, params.id),
);
