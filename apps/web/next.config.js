/** @type {import('next').NextConfig} */
const path = require('node:path');
const isProd = process.env.NODE_ENV === 'production';

const cspDirectives = [
  "default-src 'self'",
  // Next.js dev: allow inline/eval/blob for HMR/overlay; lock down in prod
  isProd
    ? "script-src 'self'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Allow API and dev-time transports. In dev, include WebSocket to avoid hidden failures in HMR/RSC streams.
  // Note: 'self' does not implicitly cover ws: scheme.
  isProd
    ? "connect-src 'self' http://localhost:3001"
    : "connect-src 'self' http://localhost:3001 ws:",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const securityHeaders = [
  // Security & privacy
  { key: 'Content-Security-Policy', value: cspDirectives },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Transport (only meaningful over HTTPS; still set consistently)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
];

const nextConfig = {
  poweredByHeader: false,
  // Ensure Next resolves configs within this workspace (monorepo safe)
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  // Next 15+: typedRoutes at top-level
  typedRoutes: true,
};

module.exports = nextConfig;
