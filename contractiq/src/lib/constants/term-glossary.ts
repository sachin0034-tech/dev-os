import { STANDARD_TERMS } from './standard-terms';

// Plain-English tooltip text keyed by term_key (jargon explanations, WCAG/usability requirement).
export const TERM_GLOSSARY: Record<string, string> = Object.fromEntries(
  [...STANDARD_TERMS.NDA, ...STANDARD_TERMS.MSA].map((t) => [t.key, t.plainEnglish]),
);
