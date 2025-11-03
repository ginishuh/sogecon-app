/** @type {import('next').NextConfig} */
const path = require('node:path');

const securityHeaders = [
  // 보안/프라이버시 헤더
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // HTTPS 전용 헤더도 일관되게 설정
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
];

const remoteDomainsEnv = (process.env.NEXT_PUBLIC_IMAGE_DOMAINS || '')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

const imageRemotePatterns = [
  { protocol: 'http', hostname: 'localhost', port: '3001' },
  { protocol: 'http', hostname: '127.0.0.1', port: '3001' },
  ...remoteDomainsEnv.map((hostname) => ({ protocol: 'https', hostname })),
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
  images: {
    remotePatterns: imageRemotePatterns,
  },
};

module.exports = nextConfig;
