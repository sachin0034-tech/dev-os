import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';
import { requireAuth } from '@/lib/security/authGuard';
import { enforceUserRateLimit, type RateLimitAction } from '@/lib/security/rateLimiter';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { AppError, toErrorResponse } from './errors';

export interface AuthUser {
  id: string;
  email: string;
}

export interface HandlerCtx<P, B, Q> {
  req: NextRequest;
  params: P;
  body: B;
  query: Q;
  user: AuthUser;
  supabase: ServerSupabase;
  requestId: string;
}

interface HandlerOptions<P, B, Q> {
  auth?: boolean;
  params?: ZodType<P, ZodTypeDef, unknown>;
  body?: ZodType<B, ZodTypeDef, unknown>;
  query?: ZodType<Q, ZodTypeDef, unknown>;
  rateLimit?: RateLimitAction;
}

type RouteContext = { params: Promise<Record<string, string | string[]>> };

// Wraps a Route Handler: request id → auth → rate limit → Zod parsing → handler →
// JSON response; maps every error to the standard envelope (api-conventions.md §3).
export function withHandler<P = undefined, B = undefined, Q = undefined>(
  opts: HandlerOptions<P, B, Q>,
  fn: (ctx: HandlerCtx<P, B, Q>) => Promise<unknown>,
) {
  return async (req: NextRequest, route: RouteContext): Promise<Response> => {
    const requestId = crypto.randomUUID();
    try {
      let supabase: ServerSupabase;
      let user: AuthUser = { id: '', email: '' };

      if (opts.auth !== false) {
        const auth = await requireAuth(requestId);
        if (!auth.ok) return auth.response;
        supabase = auth.supabase;
        user = auth.user;
        if (opts.rateLimit) await enforceUserRateLimit(opts.rateLimit, user.id);
      } else {
        supabase = await createClient();
      }

      const params = (opts.params ? opts.params.parse((await route?.params) ?? {}) : undefined) as P;
      const query = (
        opts.query
          ? opts.query.parse(Object.fromEntries(req.nextUrl.searchParams.entries()))
          : undefined
      ) as Q;

      let body = undefined as B;
      if (opts.body) {
        let json: unknown;
        try {
          json = await req.json();
        } catch {
          throw new AppError('VALIDATION_ERROR', { fieldErrors: { body: ['Invalid JSON body'] } });
        }
        body = opts.body.parse(json);
      }

      const result = await fn({ req, params, body, query, user, supabase, requestId });

      if (result instanceof Response) {
        result.headers.set('x-request-id', requestId);
        return result;
      }
      return NextResponse.json(result ?? null, { headers: { 'x-request-id': requestId } });
    } catch (err) {
      if (err instanceof AppError) {
        if (err.status >= 500) {
          logger.error('api.error', { requestId, route: req.nextUrl.pathname, code: err.code, cause: err.cause });
        }
        return toErrorResponse(err, requestId);
      }
      if (err instanceof ZodError) {
        return toErrorResponse(
          new AppError('VALIDATION_ERROR', {
            fieldErrors: err.flatten().fieldErrors as Record<string, string[]>,
          }),
          requestId,
        );
      }
      logger.error('api.unhandled', { requestId, route: req.nextUrl.pathname, err });
      return toErrorResponse(new AppError('INTERNAL'), requestId);
    }
  };
}
