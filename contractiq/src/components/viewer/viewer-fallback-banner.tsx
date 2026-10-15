import { Alert } from '@/components/ui/alert';
import type { FallbackReason } from '@/stores/viewer-store';

const MESSAGES: Record<FallbackReason, string> = {
  not_stored: 'PDF preview unavailable — showing extracted text.',
  unavailable: 'PDF preview unavailable — showing extracted text.',
  retention: 'The original PDF was removed after 90 days of inactivity — showing extracted text.',
  render_failed: "We couldn't display this PDF — showing extracted text.",
  user: 'Showing extracted text.',
};

export function ViewerFallbackBanner({ reason }: { reason: FallbackReason }) {
  if (reason === 'user') return null;
  return (
    <Alert tone="warning" className="mx-4 mt-4">
      {MESSAGES[reason]}
    </Alert>
  );
}
