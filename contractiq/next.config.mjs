/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return '';
  }
})();

// Content-Security-Policy — docs/security/security-plan.md §8.
// - connect-src: Supabase (auth, storage uploads, signed PDF URLs fetched by pdf.js)
// - worker-src: pdf.js worker is served from /public (blob: for pdf.js internals)
// - 'unsafe-inline' scripts are required by Next.js App Router hydration without nonces;
//   'unsafe-eval' only in development (React Refresh).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}${isDev ? ' ws: wss:' : ''}`.trim(),
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig = {
  // Lets verification builds (NEXT_DIST_DIR=.next-verify npm run build) run alongside `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  // The app uses no next/image; disabling the optimizer removes the /_next/image attack surface.
  images: { unoptimized: true },
  // pdfjs-dist runs on the server for text extraction; load it from node_modules, not the bundle.
  serverExternalPackages: ['pdfjs-dist'],
  // Belt and braces: ship the pdf.js worker with the extraction function on Vercel.
  outputFileTracingIncludes: {
    '/api/contracts/[id]/extract': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
  webpack: (config) => {
    // react-pdf: pdf.js optionally requires `canvas`, which we never use in the browser.
    config.resolve.alias.canvas = false;
    return config;
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // API responses are user-specific: never cache them in shared caches.
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
