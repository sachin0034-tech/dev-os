import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/utils/logger';

describe('logger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes JSON and redacts sensitive fields recursively', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test.event', { userId: 'u1', contractText: 'SECRET', nested: { content: 'x', ok: 1 } });
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({
      level: 'info',
      event: 'test.event',
      userId: 'u1',
      contractText: '[redacted]',
      nested: { content: '[redacted]', ok: 1 },
    });
  });
});
