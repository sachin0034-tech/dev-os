import { FileSearch, Gauge, MessagesSquare } from 'lucide-react';

const PROPS = [
  {
    icon: FileSearch,
    title: 'Page-level references',
    body: 'Every term links to the page it came from, so you can check it in one click.',
  },
  {
    icon: Gauge,
    title: 'Confidence you can see',
    body: 'Each term shows a confidence score. Low-confidence terms are flagged so you know what to double-check.',
  },
  {
    icon: MessagesSquare,
    title: 'Chat grounded in your document',
    body: 'Ask questions in plain English. Answers cite pages and never draw on outside guesses.',
  },
];

export function ValueProps() {
  return (
    <section aria-labelledby="value-props-title" className="flex flex-col gap-6">
      <h2 id="value-props-title" className="text-h5">
        Built for people who sign contracts without a lawyer on call
      </h2>
      <div className="grid gap-6 md:grid-cols-3">
        {PROPS.map(({ icon: Icon, title, body }) => (
          <article key={title} className="flex flex-col gap-2 rounded-lg border border-default bg-primary p-6">
            <Icon className="h-6 w-6 text-brand" aria-hidden />
            <h3 className="text-body-lg">{title}</h3>
            <p className="text-body-sm text-secondary">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
