'use client';

import { create } from 'zustand';
import type { ConfidenceBand } from '@/types/api';

export type ResultsTab = 'terms' | 'chat' | 'document';
export type BandFilter = 'all' | ConfidenceBand;

interface ResultsUiState {
  activeTab: ResultsTab;
  bandFilter: BandFilter;
  setActiveTab: (tab: ResultsTab) => void;
  setBandFilter: (filter: BandFilter) => void;
  reset: () => void;
}

export const useResultsUiStore = create<ResultsUiState>()((set) => ({
  activeTab: 'terms',
  bandFilter: 'all',
  setActiveTab: (activeTab) => set({ activeTab }),
  setBandFilter: (bandFilter) => set({ bandFilter }),
  reset: () => set({ activeTab: 'terms', bandFilter: 'all' }),
}));
