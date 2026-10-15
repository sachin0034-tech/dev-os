import { describe, expect, it } from 'vitest';
import { AppError, mapPgError, toErrorResponse } from '@/lib/api/errors';

describe('mapPgError', () => {
  it('maps known Postgres errors', () => {
    expect(mapPgError({ code: '23505', message: 'duplicate key value violates unique constraint "custom_key_terms_contract_name_unique"' }).code).toBe('CUSTOM_TERM_DUPLICATE');
    expect(mapPgError({ code: 'P0001', message: 'CUSTOM_TERM_LIMIT' }).code).toBe('CUSTOM_TERM_LIMIT');
    expect(mapPgError({ code: 'P0002', message: 'CONTRACT_NOT_FOUND' }).code).toBe('NOT_FOUND');
    expect(mapPgError({ code: '42501', message: 'permission denied' }).code).toBe('NOT_FOUND');
    expect(mapPgError({ code: '22P02', message: 'invalid input syntax for type uuid' }).code).toBe('VALIDATION_ERROR');
    expect(mapPgError({ code: 'XX000', message: 'boom' }).code).toBe('INTERNAL');
  });
});

describe('toErrorResponse', () => {
  it('builds the standard envelope with Retry-After', async () => {
    const res = toErrorResponse(new AppError('RATE_LIMITED', { retryAfterSeconds: 41.2 }), 'req-1');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(res.headers.get('x-request-id')).toBe('req-1');
    expect(await res.json()).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: "You're doing that too often. Try again in a minute.",
        requestId: 'req-1',
      },
    });
  });
});
