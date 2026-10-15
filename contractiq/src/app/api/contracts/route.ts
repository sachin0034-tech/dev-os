import { withHandler } from '@/lib/api/handler';
import { listContracts } from '@/lib/services/contracts.service';
import { listContractsQuerySchema } from '@/lib/validation/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler({ query: listContractsQuerySchema }, async ({ supabase, query }) =>
  listContracts(supabase, query),
);
