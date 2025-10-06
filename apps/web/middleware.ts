import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Dev-only lightweight logger to surface RSC "flight" requests in server logs.
// Helps when Network tab doesn't show the failing request (e.g., due to SW or filters).
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    const url = req.nextUrl;
    const isFlight = url.searchParams.has('__flight__');
    const accept = req.headers.get('accept') || '';
    // 진단 목적: 요청에 힌트를 추가하여 서버/클라이언트에서 식별 가능하도록 함(로그 사용 없음)
    if (isFlight || accept.includes('text/x-component')) {
      req.headers.set('x-rsc-flight', '1');
    }
  }
  return NextResponse.next();
}

// Exclude static assets to reduce noise
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
};
