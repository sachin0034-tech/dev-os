// Generates reproducible PDF fixtures for tests: `npx tsx scripts/make-fixtures.ts`
// docs/specs/testing-and-evals.md §3
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const OUT = join(process.cwd(), 'tests', 'fixtures', 'pdfs');
mkdirSync(OUT, { recursive: true });

const NDA_PAGES = [
  [
    'MUTUAL NON-DISCLOSURE AGREEMENT',
    'This Mutual Non-Disclosure Agreement is entered into as of January 15, 2026 (the "Effective Date")',
    'by and between Acme Robotics, Inc., a Delaware corporation ("Acme"), and Beta Logistics LLC ("Beta").',
    '1. Purpose. The parties wish to explore a potential business relationship concerning warehouse',
    'automation and may disclose confidential information to each other for that purpose.',
    '2. Confidential Information. "Confidential Information" means any non-public business, technical',
    'or financial information disclosed by one party to the other, whether orally or in writing.',
    '3. Obligations. The receiving party shall hold Confidential Information in strict confidence, use',
    'it solely for the Purpose, and protect it with at least a reasonable degree of care.',
  ],
  [
    '4. Permitted Disclosures. The receiving party may disclose Confidential Information to its employees',
    'and advisors who need to know it and are bound by confidentiality obligations at least as protective.',
    '5. Term. This Agreement remains in effect for two (2) years from the Effective Date, and the',
    'confidentiality obligations survive for three (3) years after termination.',
    '6. Non-Solicitation. During the term and for twelve (12) months after, neither party shall solicit',
    'for employment any employee of the other party with whom it had contact under this Agreement.',
    '7. Remedies. Unauthorized disclosure may cause irreparable harm, and the disclosing party shall be',
    'entitled to seek injunctive relief in addition to any other remedies available at law.',
  ],
  [
    '8. No License. Nothing in this Agreement grants any license to intellectual property of either party.',
    '9. Governing Law. This Agreement shall be governed by the laws of the State of Delaware.',
    '10. Jurisdiction. The parties submit to the exclusive jurisdiction of the courts located in',
    'Wilmington, Delaware for any dispute arising out of this Agreement.',
    'IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.',
  ],
];

async function textPdf(pages: string[][], file: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage([612, 792]);
    lines.forEach((line, i) => page.drawText(line, { x: 50, y: 740 - i * 18, size: 10, font }));
  }
  writeFileSync(join(OUT, file), await doc.save());
}

async function main() {
  await textPdf(NDA_PAGES, 'nda-sample.pdf');
  await textPdf(NDA_PAGES.slice(0, 1), 'small-nda.pdf');
  // 21 pages → TOO_MANY_PAGES
  await textPdf(Array.from({ length: 21 }, () => NDA_PAGES[0]!), '21-pages.pdf');
  // image-only stand-in: a page with almost no text → SCANNED_PDF
  await textPdf([['Scanned page']], 'scanned.pdf');
  // PNG bytes renamed .pdf → NOT_A_PDF
  writeFileSync(join(OUT, 'not-a-pdf.pdf'), Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'));
  console.log('fixtures written to', OUT);
}

void main();
