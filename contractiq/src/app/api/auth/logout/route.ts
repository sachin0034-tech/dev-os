import { withHandler } from '@/lib/api/handler';
import { audit } from '@/lib/security/auditLog';
import { assertSameOrigin } from '@/lib/security/authGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server-side sign-out: revokes the session and clears auth cookies.
export const POST = withHandler({ auth: false }, async ({ req, supabase }) => {
  assertSameOrigin(req);
  const { data } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (data.user) audit('auth.logout', { userId: data.user.id });
  return { ok: true };
});
