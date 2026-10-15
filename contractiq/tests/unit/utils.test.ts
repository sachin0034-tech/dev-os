import { describe, expect, it } from 'vitest';
import { confidenceBand } from '@/lib/utils/confidence';
import { toTermKey } from '@/lib/utils/slug';
import { bigramContainment, normalizeForMatch } from '@/lib/utils/text-normalize';
import { parseSseBlock, readSse, sseEvent } from '@/lib/utils/sse';

describe('confidenceBand', () => {
  it.each([
    [0, 'low'],
    [49, 'low'],
    [50, 'medium'],
    [79, 'medium'],
    [80, 'high'],
    [100, 'high'],
  ] as const)('%i → %s', (score, band) => {
    expect(confidenceBand(score)).toBe(band);
  });
});

describe('toTermKey', () => {
  it('slugifies standard and custom names', () => {
    expect(toTermKey('Governing Law', false)).toBe('governing_law');
    expect(toTermKey('Non-compete radius', true)).toBe('custom_noncompete_radius');
    expect(toTermKey('  Café   terms ', true)).toBe('custom_cafe_terms');
    expect(toTermKey('!!!', false)).toBe('term');
  });
});

describe('text normalisation', () => {
  it('normalises quotes, dashes, hyphenated line breaks and whitespace', () => {
    expect(normalizeForMatch('The “Agreement” shall\n  be gov-\nerned')).toBe(
      'the "agreement" shall be governed',
    );
  });

  it('scores bigram containment', () => {
    const page = 'This Agreement shall be governed by the laws of the State of Delaware.';
    expect(bigramContainment('governed by the laws of the State of Delaware', page)).toBe(1);
    expect(bigramContainment('governed by the laws of New York', page)).toBeLessThan(0.85);
    expect(bigramContainment('Delaware', page)).toBe(1);
    expect(bigramContainment('', page)).toBe(0);
  });
});

describe('SSE', () => {
  it('encodes and parses an event', () => {
    const text = new TextDecoder().decode(sseEvent('token', { t: 'hi' }));
    expect(parseSseBlock(text.trim())).toEqual({ event: 'token', data: { t: 'hi' } });
  });

  it('reads events split across chunk boundaries', async () => {
    const chunks = ['event: meta\ndata: {"a"', ':1}\n\nevent: tok', 'en\ndata: {"t":"x"}\n\n'];
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((s) => c.enqueue(new TextEncoder().encode(s)));
        c.close();
      },
    });
    const events = [];
    for await (const e of readSse(new Response(stream))) events.push(e);
    expect(events).toEqual([
      { event: 'meta', data: { a: 1 } },
      { event: 'token', data: { t: 'x' } },
    ]);
  });
});
