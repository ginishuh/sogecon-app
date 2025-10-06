import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Dev-only lightweight logger to surface RSC "flight" requests in server logs.
// Helps when Network tab doesn't show the failing request (e.g., due to SW or filters).
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    const url = req.nextUrl;
    const isFlight = url.searchParams.has('__flight__');
    const accept = req.headers.get('accept') || '';
    if (isFlight || accept.includes('text/x-component')) {
      const headers = new Headers(req.headers);
      headers.set('x-rsc-flight', '1');
      return NextResponse.next({ request: { headers } });
    }
  }
  return NextResponse.next();
}

// Exclude static assets to reduce noise
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
};
