import { timingSafeEqual } from 'node:crypto';
import { AppError } from '@/lib/api/errors';
import { withHandler } from '@/lib/api/handler';
import { env } from '@/lib/env';
import { runRetention } from '@/lib/services/retention.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel Cron (daily 03:00 UTC) — authenticated with CRON_SECRET, not a user session.
export const GET = withHandler({ auth: false }, async ({ req }) => {
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new AppError('UNAUTHORIZED_CRON');
  }
  return runRetention();
});
