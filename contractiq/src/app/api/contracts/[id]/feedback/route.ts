import { withHandler } from '@/lib/api/handler';
import { upsertFeedback } from '@/lib/services/feedback.service';
import { idParamSchema } from '@/lib/validation/common';
import { feedbackSchema } from '@/lib/validation/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(
  { params: idParamSchema, body: feedbackSchema, rateLimit: 'feedback' },
  async ({ params, body, supabase, user }) => upsertFeedback(supabase, user, params.id, body),
);
