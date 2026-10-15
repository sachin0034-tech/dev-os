import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Session refresh + route protection — docs/security/security-plan.md §1
const PROTECTED_PREFIXES = ['/dashboard', '/contracts', '/chat', '/settings', '/profile', '/reset-password'];
const AUTH_PAGES = ['/login', '/signup', '/forgot-password'];

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((p) => matches(pathname, p))) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  if (user && AUTH_PAGES.includes(pathname)) return NextResponse.redirect(new URL('/dashboard', request.url));

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|pdf.worker.min.mjs|landing/|.*\\.(?:svg|png|jpg|jpeg|webp|woff2)$).*)',
  ],
};
