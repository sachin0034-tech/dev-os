'use client';

import { useEffect, useRef, useState } from 'react';
import { useViewerStore } from '@/stores/viewer-store';

const HIGHLIGHT_MS = 3000;

// Shared by both viewers: scrolls to targetPage on every navigation and exposes the active
// highlight (cleared after 3 s). Also tracks the page currently in view.
export function usePageNavigation(slotRefs: React.MutableRefObject<(HTMLElement | null)[]>, ready: boolean) {
  const { navNonce, targetPage, highlightText, setCurrentPage } = useViewerStore();
  const [activeHighlight, setActiveHighlight] = useState<{ page: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!ready || !navNonce || !targetPage) return;
    const el = slotRefs.current[targetPage - 1];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setActiveHighlight(highlightText ? { page: targetPage, text: highlightText } : null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setActiveHighlight(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navNonce, ready]);

  useEffect(() => {
    if (!ready) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const page = visible ? Number((visible.target as HTMLElement).dataset.page) : NaN;
        if (Number.isFinite(page)) setCurrentPage(page);
      },
      { threshold: [0.25, 0.5, 0.75] },
    );
    slotRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [ready, slotRefs, setCurrentPage]);

  return activeHighlight;
}
