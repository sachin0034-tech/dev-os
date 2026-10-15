// Maps a quoted sentence onto original text so it can be highlighted — contract-viewer.md §8.
const normChar = (c: string): string => {
  if (/[‘’‛]/.test(c)) return "'";
  if (/[“”]/.test(c)) return '"';
  if (/[‐-―]/.test(c)) return '-';
  return c.toLowerCase();
};

// Normalized string (collapsed whitespace, unified quotes/dashes) + index map back to the original.
export function buildNormalizedIndex(original: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < original.length; i++) {
    const c = original[i]!;
    if (/\s/.test(c)) {
      if (!lastWasSpace) {
        norm += ' ';
        map.push(i);
        lastWasSpace = true;
      }
      continue;
    }
    norm += normChar(c);
    map.push(i);
    lastWasSpace = false;
  }
  return { norm, map };
}

const normalizeNeedle = (s: string) => buildNormalizedIndex(s).norm.trim();

export function findRange(original: string, needle: string): [number, number] | null {
  const n = normalizeNeedle(needle);
  if (n.length < 3) return null;
  const { norm, map } = buildNormalizedIndex(original);
  const at = norm.indexOf(n);
  if (at === -1) return null;
  const start = map[at]!;
  const end = map[at + n.length - 1]! + 1;
  return [start, end];
}

// PDF text layer: highlight items whose text appears inside the needle.
export function itemInNeedle(itemStr: string, needleNorm: string): boolean {
  const s = normalizeNeedle(itemStr);
  return s.length >= 3 && needleNorm.includes(s);
}

export const normalizeForHighlight = normalizeNeedle;
