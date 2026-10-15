import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Inter with the optical-size axis: large sizes render with the Inter Display cut.
const inter = Inter({
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-inter-display',
});

export const metadata: Metadata = {
  title: { default: 'ContractIQ — AI review for NDAs and MSAs', template: '%s · ContractIQ' },
  description:
    'Upload an NDA or MSA and ContractIQ pulls out the terms that matter, with page references and confidence scores, then answers your questions using only what the document says.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
