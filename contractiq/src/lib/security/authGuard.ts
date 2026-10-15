import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { AppError, toErrorResponse } from '@/lib/api/errors';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';

// Authentication guard for Route Handlers — docs/security/security-plan.md §1.

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export type AuthResult =
  | { ok: true; user: AuthenticatedUser; supabase: ServerSupabase }
  | { ok: false; response: NextResponse };

/**
 * Verifies the session with Supabase (getUser() validates the JWT server-side — never trust
 * getSession() on the server). Returns the user, or a ready-to-return 401 response.
 */
export async function requireAuth(requestId = crypto.randomUUID()): Promise<AuthResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: toErrorResponse(new AppError('UNAUTHENTICATED'), requestId) };
  }
  return { ok: true, user: { id: data.user.id, email: data.user.email ?? '' }, supabase };
}

/**
 * CSRF defence for state-changing auth endpoints called with fetch(): the Origin header must
 * match this app. (Server Actions get Next's built-in origin check.)
 */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  const allowed = new Set([req.nextUrl.origin]);
  if (process.env.NEXT_PUBLIC_APP_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  if (!origin || !allowed.has(origin)) throw new AppError('FORBIDDEN_ORIGIN');
}
