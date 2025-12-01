/** @type {import('next').NextConfig} */
const path = require('node:path');

// Bundle analyzer: ANALYZE=true pnpm -C apps/web build
// 런타임에서는 devDependency가 없으므로 조건부 로드
const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true })
    : (config) => config;

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
  // standalone 빌드 산출물을 생성하여 서버(systemd)에서 직접 구동
  // 참고: 이 모드는 런타임에 node_modules 설치 없이 동작하도록 번들합니다.
  output: 'standalone',
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
    // 최신 이미지 포맷 우선 (브라우저 지원 시 AVIF → WebP → 원본)
    formats: ['image/avif', 'image/webp'],
    // 디바이스 크기 (기본값 유지하되 명시적 선언)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 품질은 <Image quality={85}> prop으로 개별 지정
  },
};

module.exports = withBundleAnalyzer(nextConfig);
