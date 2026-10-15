import type { FewShotExample } from '../types';

export const MSA_EXAMPLES: FewShotExample[] = [
  {
    excerpt: `[PAGE 2]
4.1 Fees. Customer shall pay all undisputed invoices within thirty (30) days of the invoice date.
4.2 Invoicing. Provider will invoice Customer monthly in arrears for Services performed during the prior month.
4.3 Late Payments. Overdue amounts shall accrue interest at the rate of 1.5% per month or the maximum rate permitted by law, whichever is lower.`,
    requested: [
      { key: 'payment_terms', name: 'Payment Terms' },
      { key: 'invoice_schedule', name: 'Invoice Schedule' },
      { key: 'late_payment_penalty', name: 'Late Payment Penalty' },
    ],
    output: {
      terms: [
        { term_key: 'payment_terms', term_name: 'Payment Terms', value: 'Undisputed invoices are due within 30 days of the invoice date (net 30).', page_number: 2, confidence_score: 95, source_sentence: 'Customer shall pay all undisputed invoices within thirty (30) days of the invoice date.' },
        { term_key: 'invoice_schedule', term_name: 'Invoice Schedule', value: 'Monthly, in arrears, for services performed in the prior month.', page_number: 2, confidence_score: 92, source_sentence: 'Provider will invoice Customer monthly in arrears for Services performed during the prior month.' },
        { term_key: 'late_payment_penalty', term_name: 'Late Payment Penalty', value: 'Interest of 1.5% per month (or the legal maximum, if lower) on overdue amounts.', page_number: 2, confidence_score: 94, source_sentence: 'Overdue amounts shall accrue interest at the rate of 1.5% per month or the maximum rate permitted by law, whichever is lower.' },
      ],
    },
  },
  {
    excerpt: `[PAGE 3]
9. Limitation of Liability. EXCEPT FOR A PARTY'S INDEMNIFICATION OBLIGATIONS,
[PAGE 4]
IN NO EVENT SHALL EITHER PARTY'S AGGREGATE LIABILITY EXCEED THE FEES PAID BY CUSTOMER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, AND NEITHER PARTY SHALL BE LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES.
10. Indemnification. Each party shall defend and indemnify the other against third-party claims alleging that its materials infringe any intellectual property right.`,
    requested: [
      { key: 'liability_cap', name: 'Liability Cap' },
      { key: 'indemnification', name: 'Indemnification' },
    ],
    output: {
      terms: [
        { term_key: 'liability_cap', term_name: 'Liability Cap', value: "Each party's total liability is capped at the fees paid in the 12 months before the claim (except indemnification); indirect and consequential damages are excluded.", page_number: 4, confidence_score: 90, source_sentence: "IN NO EVENT SHALL EITHER PARTY'S AGGREGATE LIABILITY EXCEED THE FEES PAID BY CUSTOMER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, AND NEITHER PARTY SHALL BE LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES." },
        { term_key: 'indemnification', term_name: 'Indemnification', value: 'Mutual: each party defends and indemnifies the other against third-party IP infringement claims about its materials.', page_number: 4, confidence_score: 85, source_sentence: 'Each party shall defend and indemnify the other against third-party claims alleging that its materials infringe any intellectual property right.' },
      ],
    },
  },
  {
    excerpt: `[PAGE 6]
12.1 Termination for Convenience. Either party may terminate this Agreement for any reason upon thirty (30) days' prior written notice.
12.2 Termination for Cause. Either party may terminate this Agreement if the other party materially breaches it and fails to cure such breach within fifteen (15) days after receiving written notice.
15. Notices. All notices shall be in writing and delivered by courier or email to the addresses set out above.`,
    requested: [
      { key: 'termination_clause', name: 'Termination Clause' },
      { key: 'notice_period', name: 'Notice Period' },
      { key: 'dispute_resolution', name: 'Dispute Resolution' },
    ],
    output: {
      terms: [
        { term_key: 'termination_clause', term_name: 'Termination Clause', value: "Either party may terminate for convenience with 30 days' written notice, or for an uncured material breach after a 15-day cure period.", page_number: 6, confidence_score: 88, source_sentence: "Either party may terminate this Agreement for any reason upon thirty (30) days' prior written notice." },
        { term_key: 'notice_period', term_name: 'Notice Period', value: "30 days' written notice to terminate for convenience; notices must be in writing by courier or email.", page_number: 6, confidence_score: 60, source_sentence: 'All notices shall be in writing and delivered by courier or email to the addresses set out above.' },
        { term_key: 'dispute_resolution', term_name: 'Dispute Resolution', value: null, page_number: null, confidence_score: 0, source_sentence: null },
      ],
    },
  },
];
