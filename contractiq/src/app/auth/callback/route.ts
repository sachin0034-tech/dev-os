import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/validation/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Email-link target (verification and password recovery): exchanges the PKCE code for a
// session cookie, then continues to a same-site `next` path.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const loginExpired = new URL('/login?error=link_expired', request.url);
  if (!code) return NextResponse.redirect(loginExpired);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(error ? loginExpired : new URL(next, request.url));
}
