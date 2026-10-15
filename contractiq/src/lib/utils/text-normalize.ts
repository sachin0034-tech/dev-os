// Text normalisation used to match model-quoted sentences against the contract.
// docs/specs/ai-extraction-pipeline.md §6
export const normalizeForMatch = (s: string): string =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/-\n/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const words = (s: string): string[] =>
  normalizeForMatch(s)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

const bigrams = (ws: string[]): string[] => ws.slice(1).map((w, i) => `${ws[i]} ${w}`);

// Share of the needle's word bigrams that also occur in the haystack (0–1).
export function bigramContainment(needle: string, haystack: string): number {
  const n = words(needle);
  const h = words(haystack);
  if (n.length === 0) return 0;
  if (n.length < 2) return h.includes(n[0]!) ? 1 : 0;
  const hay = new Set(bigrams(h));
  const nb = bigrams(n);
  return nb.filter((b) => hay.has(b)).length / nb.length;
}
