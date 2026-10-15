import { CircleCheck, CircleMinus, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CONFIDENCE_LABEL, confidenceBand } from '@/lib/utils/confidence';

const TONE = { high: 'success', medium: 'warning', low: 'danger' } as const;
const ICON = { high: CircleCheck, medium: CircleMinus, low: TriangleAlert } as const;

// Colour + text + icon, never colour alone (design-tokens.md §6–7).
export function ConfidenceBadge({ score }: { score: number }) {
  const band = confidenceBand(score);
  const Icon = ICON[band];
  return (
    <Badge tone={TONE[band]} aria-label={`Confidence ${score} percent, ${CONFIDENCE_LABEL[band]}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {score}% · {CONFIDENCE_LABEL[band]}
    </Badge>
  );
}
