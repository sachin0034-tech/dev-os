import { bigramContainment, normalizeForMatch } from '@/lib/utils/text-normalize';

// Helpers for contract text stored with "[PAGE N]" markers (shared by server and client).
const MARKER_SPLIT = /^\[PAGE (\d+)\]\s*$/m;

export interface PageText {
  page: number;
  text: string;
}

export function splitPages(text: string): PageText[] {
  const parts = text.split(MARKER_SPLIT);
  const pages: PageText[] = [];
  // parts = [preamble, "1", page1text, "2", page2text, ...]
  for (let i = 1; i < parts.length; i += 2) {
    pages.push({ page: Number(parts[i]), text: (parts[i + 1] ?? '').trim() });
  }
  if (pages.length === 0 && text.trim()) pages.push({ page: 1, text: text.trim() });
  return pages;
}

export const stripMarkers = (text: string): string => text.replace(/^\[PAGE \d+\]\s*$/gm, '');

// Page containing `needle`: exact normalized match first, then best bigram match ≥ 0.85.
export function findPageOf(text: string, needle: string): number | null {
  const pages = splitPages(text);
  const n = normalizeForMatch(needle);
  if (!n) return null;
  for (const p of pages) if (normalizeForMatch(p.text).includes(n)) return p.page;
  let best: { page: number; score: number } | null = null;
  for (const p of pages) {
    const score = bigramContainment(needle, p.text);
    if (!best || score > best.score) best = { page: p.page, score };
  }
  return best && best.score >= 0.85 ? best.page : null;
}
