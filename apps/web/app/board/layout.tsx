"use client";

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthGuard } from '../../components/auth-guard';

export function isPublicBoardPath(pathname: string): boolean {
  return pathname === '/board/new';
}

export default function BoardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isPublicBoardPath(pathname)) return <>{children}</>;
  return <AuthGuard>{children}</AuthGuard>;
}
