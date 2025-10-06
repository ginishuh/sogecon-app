import { NextResponse } from 'next/server';

// Minimal handler to stop 404 noise during dev when no favicon is provided.
export function GET() {
  return new NextResponse(null, { status: 204 });
}

