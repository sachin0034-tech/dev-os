'use client';

import { create } from 'zustand';

// Viewer navigation state shared by key-term cards, chat citations and both viewers.
// docs/specs/contract-viewer.md §4
export type ViewerMode = 'pdf' | 'text';
export type FallbackReason = 'not_stored' | 'unavailable' | 'retention' | 'render_failed' | 'user';

interface ViewerState {
  mode: ViewerMode;
  fallbackReason: FallbackReason | null;
  targetPage: number | null;
  highlightText: string | null;
  navNonce: number;
  zoom: number;
  currentPage: number;
  pageCount: number;
  userHasNavigated: boolean;
  setTarget: (page: number, text: string | null, opts?: { auto?: boolean }) => void;
  setMode: (mode: ViewerMode, reason?: FallbackReason | null) => void;
  setZoom: (zoom: number) => void;
  setCurrentPage: (page: number) => void;
  setPageCount: (count: number) => void;
  reset: () => void;
}

const initial = {
  mode: 'pdf' as ViewerMode,
  fallbackReason: null,
  targetPage: null,
  highlightText: null,
  navNonce: 0,
  zoom: 1,
  currentPage: 1,
  pageCount: 0,
  userHasNavigated: false,
};

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;
export const ZOOM_STEP = 0.25;

export const useViewerStore = create<ViewerState>()((set) => ({
  ...initial,
  setTarget: (page, text, opts) =>
    set((s) => ({
      targetPage: s.pageCount > 0 ? Math.min(Math.max(1, page), s.pageCount) : page,
      highlightText: text,
      navNonce: s.navNonce + 1,
      userHasNavigated: s.userHasNavigated || !opts?.auto,
    })),
  setMode: (mode, reason = null) => set({ mode, fallbackReason: mode === 'text' ? reason : null }),
  setZoom: (zoom) => set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setPageCount: (pageCount) => set({ pageCount }),
  reset: () => set({ ...initial }),
}));
