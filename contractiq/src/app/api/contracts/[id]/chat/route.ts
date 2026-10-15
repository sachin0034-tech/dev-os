import { withHandler } from '@/lib/api/handler';
import { enforceUserRateLimit } from '@/lib/security/rateLimiter';
import { getChatHistory, streamAnswer } from '@/lib/services/chat.service';
import { chatHistoryQuerySchema, chatPostSchema } from '@/lib/validation/chat';
import { idParamSchema } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = withHandler(
  { params: idParamSchema, query: chatHistoryQuerySchema },
  async ({ params, query, supabase, user }) => getChatHistory(supabase, user, params.id, query),
);

export const POST = withHandler(
  { params: idParamSchema, body: chatPostSchema, rateLimit: 'chat' },
  async ({ req, params, body, supabase, user }) => {
    await enforceUserRateLimit('chat_daily', user.id);
    return streamAnswer(supabase, user, params.id, body, req.signal);
  },
);
