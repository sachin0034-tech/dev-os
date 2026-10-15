const STEPS = [
  'Upload your NDA or MSA (PDF, up to 20 pages)',
  'Review key terms with page numbers and confidence',
  'Ask follow-up questions and correct anything we got wrong',
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="flex flex-col gap-6">
      <h2 id="how-title" className="text-h5">
        How it works
      </h2>
      <ol className="grid gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-4">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-tint text-body-lg text-info-text"
            >
              {i + 1}
            </span>
            <p className="text-body-lg">{step}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
