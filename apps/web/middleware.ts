import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { buildCspDirective } from './lib/csp';

const isProd = process.env.NODE_ENV === 'production';
const relaxCsp = !isProd || process.env.NEXT_PUBLIC_RELAX_CSP === '1';
const analyticsId = process.env.NEXT_PUBLIC_ANALYTICS_ID;
const apiBase = process.env.NEXT_PUBLIC_WEB_API_BASE;

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

// 개발 시 RSC Flight 요청을 로그에서 구분하기 위한 헤더를 유지한다.
export function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  const nonce = generateNonce();
  requestHeaders.set('x-nonce', nonce);

  if (!isProd) {
    const url = req.nextUrl;
    const isFlight = url.searchParams.has('__flight__');
    const accept = req.headers.get('accept') || '';
    if (isFlight || accept.includes('text/x-component')) {
      requestHeaders.set('x-rsc-flight', '1');
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(
    'Content-Security-Policy',
    buildCspDirective({
      nonce,
      relaxCsp,
      analyticsId,
      apiBase,
    }),
  );
  return response;
}

// 정적 자산은 제외해 불필요한 헤더 계산을 줄인다.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
};
