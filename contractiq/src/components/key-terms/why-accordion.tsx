'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function WhyAccordion({
  sourceSentence,
  page,
  flags,
  onNavigate,
}: {
  sourceSentence: string | null;
  page: number | null;
  flags: string[];
  onNavigate: () => void;
}) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="why">
        <AccordionTrigger>Why?</AccordionTrigger>
        <AccordionContent>
          {sourceSentence ? (
            <figure className="flex flex-col gap-1">
              <blockquote className="border-l-2 border-strong pl-3 text-body-lg">{sourceSentence}</blockquote>
              <figcaption className="text-body-sm text-secondary">
                {page !== null ? (
                  <button type="button" onClick={onNavigate} className="text-brand hover:underline">
                    Page {page}
                  </button>
                ) : (
                  'Page not identified'
                )}
                {flags.includes('source_not_found') && (
                  <> · We couldn&apos;t locate this exact sentence in the document.</>
                )}
              </figcaption>
            </figure>
          ) : (
            <p className="text-body-sm text-secondary">
              No supporting sentence found — treat this value as unverified.
            </p>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
