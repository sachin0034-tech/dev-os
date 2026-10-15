import { CONFIDENCE_HIGH, CONFIDENCE_LOW } from '@/lib/constants/limits';
import type { ConfidenceBand } from '@/types/api';

export const confidenceBand = (score: number): ConfidenceBand =>
  score >= CONFIDENCE_HIGH ? 'high' : score >= CONFIDENCE_LOW ? 'medium' : 'low';

export const CONFIDENCE_LABEL: Record<ConfidenceBand, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};
