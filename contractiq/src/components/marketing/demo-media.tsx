import { TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Illustrative preview of the results screen (decorative; real data comes from the app).
const ROWS = [
  { name: 'Governing Law', value: 'State of Delaware', page: 7, score: 94, tone: 'success' as const, band: 'High' },
  { name: 'Term & Duration', value: '2 years; obligations survive 3 years', page: 3, score: 68, tone: 'warning' as const, band: 'Medium' },
  { name: 'Non-Solicitation', value: '12 months, employees only', page: 5, score: 41, tone: 'danger' as const, band: 'Low' },
];

export function DemoMedia() {
  return (
    <figure className="flex flex-col gap-2">
      <div
        role="img"
        aria-label="ContractIQ results page showing key terms next to the contract"
        className="grid overflow-hidden rounded-lg border border-default bg-primary md:grid-cols-[1.1fr_1fr]"
      >
        <div aria-hidden className="hidden flex-col gap-2 border-r border-default bg-subtle p-6 md:flex">
          <div className="flex flex-col gap-2 rounded-md border border-default bg-primary p-4">
            <span className="text-body-sm text-secondary">Page 7</span>
            {[92, 100, 85, 96].map((w, i) => (
              <span key={i} className="h-2 rounded-sm bg-subtle" style={{ width: `${w}%` }} />
            ))}
            <span className="h-2 w-3/4 rounded-sm bg-highlight" />
            {[88, 70].map((w, i) => (
              <span key={i} className="h-2 rounded-sm bg-subtle" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <ul aria-hidden className="flex flex-col gap-2 bg-surface p-4">
          {ROWS.map((r) => (
            <li key={r.name} className="flex flex-col gap-2 rounded-md border border-default bg-primary p-3">
              <span className="text-body-lg">{r.name}</span>
              <span className="text-body-sm text-secondary">{r.value}</span>
              <span className="flex items-center gap-2 text-body-sm">
                <span className="text-brand">p. {r.page}</span>
                <Badge tone={r.tone}>
                  {r.score}% · {r.band}
                </Badge>
              </span>
              {r.score < 50 && (
                <span className="flex items-center gap-1 text-body-sm text-danger-text">
                  <TriangleAlert className="h-3 w-3" aria-hidden /> Verify in the document
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="text-body-sm text-secondary">
        Every term shows its page and a confidence score you can check.
      </figcaption>
    </figure>
  );
}
