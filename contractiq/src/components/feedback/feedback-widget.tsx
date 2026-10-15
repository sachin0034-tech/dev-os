'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSubmitFeedback } from '@/hooks/use-submit-feedback';
import { MAX_FEEDBACK_COMMENT_CHARS } from '@/lib/constants/limits';
import { cn } from '@/lib/utils/cn';
import type { FeedbackValue } from '@/types/api';

type Mode = 'ask' | 'comment' | 'thanks';

// Thumbs up/down + optional comment — docs/specs/feedback.md §5.
export function FeedbackWidget({ contractId, initial }: { contractId: string; initial: FeedbackValue | null }) {
  const submit = useSubmitFeedback(contractId);
  const [mode, setMode] = useState<Mode>(initial ? 'thanks' : 'ask');
  const [rating, setRating] = useState<1 | -1 | null>(initial?.rating ?? null);
  const [comment, setComment] = useState(initial?.comment ?? '');

  const choose = (r: 1 | -1) => {
    setRating(r);
    setMode('comment');
  };

  const send = () =>
    rating &&
    submit.mutate({ rating, comment: comment.trim() || null }, { onSuccess: () => setMode('thanks') });

  const thumb = (r: 1 | -1, label: string) => {
    const Icon = r === 1 ? ThumbsUp : ThumbsDown;
    return (
      <Button
        variant="secondary"
        size="sm"
        aria-pressed={rating === r}
        onClick={() => choose(r)}
        className={cn(rating === r && 'border-brand bg-brand-tint text-brand')}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </Button>
    );
  };

  return (
    <section aria-label="Feedback" className="mt-2 flex flex-col gap-3 border-t border-default pt-4">
      {mode === 'thanks' ? (
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-body-lg">
            {rating === 1 ? <ThumbsUp className="h-4 w-4 text-brand" aria-hidden /> : <ThumbsDown className="h-4 w-4 text-brand" aria-hidden />}
            Thanks for your feedback.
          </p>
          <Button variant="link" size="sm" onClick={() => setMode('comment')}>
            Change
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-body-lg">Were these results accurate?</p>
            <div className="flex gap-2">
              {thumb(1, 'Yes')}
              {thumb(-1, 'No')}
            </div>
          </div>
          {mode === 'comment' && (
            <div className="flex flex-col gap-2">
              <Textarea
                aria-label="Feedback comment (optional)"
                placeholder="Tell us what was wrong or right (optional)"
                maxLength={MAX_FEEDBACK_COMMENT_CHARS}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-sm text-secondary">
                  {comment.length > 900 ? `${comment.length}/${MAX_FEEDBACK_COMMENT_CHARS}` : ''}
                </span>
                <span className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setMode(initial ? 'thanks' : 'ask')}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={send} loading={submit.isPending}>
                    Submit
                  </Button>
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
