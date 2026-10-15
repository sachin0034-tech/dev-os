import type { ContractType } from '@/types/api';

// Standard key terms per contract type — docs/specs/custom-key-terms.md §3.
// Shared by the preview UI, the extraction prompt and the eval harness.
export interface TermDefinition {
  key: string;
  name: string;
  definition: string;
  plainEnglish: string;
}

export const STANDARD_TERMS: Record<ContractType, TermDefinition[]> = {
  NDA: [
    { key: 'parties', name: 'Parties', definition: 'Legal names of all parties to the agreement and their roles (disclosing/receiving).', plainEnglish: 'Who is signing this agreement.' },
    { key: 'effective_date', name: 'Effective Date', definition: 'The date the agreement takes effect.', plainEnglish: 'When the agreement starts applying.' },
    { key: 'confidentiality_obligations', name: 'Confidentiality Obligations', definition: 'What the receiving party must do and must not do with confidential information, and the standard of care required.', plainEnglish: 'What you must keep secret and how carefully.' },
    { key: 'permitted_disclosures', name: 'Permitted Disclosures', definition: 'Exceptions allowing disclosure (e.g. to employees/advisors with need-to-know, legally compelled disclosure) and exclusions from confidential information.', plainEnglish: 'When you are allowed to share the information.' },
    { key: 'term_and_duration', name: 'Term & Duration', definition: 'How long the agreement lasts and how long confidentiality obligations survive after it ends.', plainEnglish: 'How long the secrecy lasts.' },
    { key: 'governing_law', name: 'Governing Law', definition: 'The jurisdiction whose laws govern the agreement.', plainEnglish: "Which place's laws apply." },
    { key: 'jurisdiction', name: 'Jurisdiction', definition: 'The courts or venue where disputes must be brought.', plainEnglish: 'Where a dispute would be heard.' },
    { key: 'ip_ownership', name: 'IP Ownership', definition: 'Statements on ownership of intellectual property in disclosed information; any licence or assignment.', plainEnglish: 'Who owns ideas and materials shared.' },
    { key: 'non_solicitation', name: 'Non-Solicitation', definition: "Restrictions on hiring or soliciting the other party's employees or customers, including duration.", plainEnglish: 'Whether you can hire their people or approach their customers.' },
    { key: 'breach_and_remedy', name: 'Breach & Remedy', definition: 'Consequences of breach: injunctive relief, damages, indemnity, return/destruction of information.', plainEnglish: 'What happens if someone breaks the agreement.' },
  ],
  MSA: [
    { key: 'parties', name: 'Parties', definition: 'Legal names of the customer and the service provider.', plainEnglish: 'Who is signing this agreement.' },
    { key: 'service_scope', name: 'Service Scope', definition: 'The services to be provided and how scope is defined (e.g. via Statements of Work).', plainEnglish: 'What work is being provided.' },
    { key: 'payment_terms', name: 'Payment Terms', definition: 'Fees, pricing basis and payment due period (e.g. net 30).', plainEnglish: 'How much and how fast you pay or get paid.' },
    { key: 'invoice_schedule', name: 'Invoice Schedule', definition: 'When and how invoices are issued (monthly, milestone, in advance/arrears).', plainEnglish: 'When invoices are sent.' },
    { key: 'late_payment_penalty', name: 'Late Payment Penalty', definition: 'Interest, fees or suspension rights for late payment.', plainEnglish: 'What happens if payment is late.' },
    { key: 'liability_cap', name: 'Liability Cap', definition: 'Maximum aggregate liability of each party and exclusions (e.g. indirect/consequential damages).', plainEnglish: 'The most either side can be made to pay if things go wrong.' },
    { key: 'indemnification', name: 'Indemnification', definition: 'Which party must defend/compensate the other for which third-party claims.', plainEnglish: 'Who covers the costs if someone else sues.' },
    { key: 'ip_ownership', name: 'IP Ownership', definition: 'Ownership of deliverables, pre-existing IP and licences granted.', plainEnglish: 'Who owns the work produced.' },
    { key: 'termination_clause', name: 'Termination Clause', definition: 'How and when either party may terminate (for convenience, for cause, cure periods) and effects of termination.', plainEnglish: 'How the agreement can be ended.' },
    { key: 'governing_law', name: 'Governing Law', definition: 'The jurisdiction whose laws govern the agreement.', plainEnglish: "Which place's laws apply." },
    { key: 'dispute_resolution', name: 'Dispute Resolution', definition: 'Process for disputes: negotiation, mediation, arbitration or courts, and venue.', plainEnglish: 'How disagreements get settled.' },
    { key: 'notice_period', name: 'Notice Period', definition: 'Required notice periods (termination, non-renewal) and how notices must be delivered.', plainEnglish: 'How much warning must be given, and how.' },
  ],
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  NDA: 'Non-Disclosure Agreement',
  MSA: 'Master Service Agreement',
};
