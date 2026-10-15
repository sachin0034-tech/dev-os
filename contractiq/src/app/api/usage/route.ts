import { withHandler } from '@/lib/api/handler';
import { getUsage } from '@/lib/services/usage.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler({}, async ({ user }) => getUsage(user.id));
