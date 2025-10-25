/** @type {import('next').NextConfig} */
const path = require('node:path');

const isProd = process.env.NODE_ENV === 'production';
const relaxCsp = !isProd || process.env.NEXT_PUBLIC_RELAX_CSP === '1';
const analyticsId = process.env.NEXT_PUBLIC_ANALYTICS_ID;
const apiBase = process.env.NEXT_PUBLIC_WEB_API_BASE;

const directiveEntries = [
  ["default-src", ["'self'"]],
  ["img-src", ["'self'", 'https:', 'data:']],
  ["script-src", ["'self'"]],
  ["style-src", ["'self'", "'unsafe-inline'"]],
  ["connect-src", ["'self'", 'https:']],
  ["font-src", ["'self'", 'data:']],
  ["worker-src", ["'self'"]],
  ["object-src", ["'none'"]],
  ["base-uri", ["'self'"]],
  ["frame-ancestors", ["'none'"]],
];

const directiveMap = new Map(directiveEntries);

function addValues(directive, values) {
  const current = directiveMap.get(directive) ?? [];
  const merged = new Set([...current, ...values]);
  directiveMap.set(directive, Array.from(merged));
}

if (relaxCsp) {
  // 개발/프리뷰 환경에서는 HMR, DevTools 등을 위해 완화
  addValues('script-src', ["'unsafe-inline'", "'unsafe-eval'", 'wasm-unsafe-eval', 'blob:']);
  addValues('connect-src', ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'ws:']);
  addValues('img-src', ['blob:']);
  addValues('worker-src', ['blob:']);
}

if (analyticsId) {
  addValues('script-src', ['https://www.googletagmanager.com']);
}

if (apiBase) {
  try {
    const apiUrl = new URL(apiBase);
    const origin = `${apiUrl.protocol}//${apiUrl.host}`;
    addValues('connect-src', [origin]);
  } catch (err) {
    // 잘못된 URL은 무시
  }
}

const cspDirectives = Array.from(directiveMap.entries())
  .map(([key, values]) => `${key} ${values.join(' ')}`)
  .join('; ');

const securityHeaders = [
  // 보안/프라이버시 헤더
  { key: 'Content-Security-Policy', value: cspDirectives },
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
