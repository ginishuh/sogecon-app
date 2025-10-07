"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';

type Props = { children: ReactNode; fallback?: ReactNode };

export function RequireAdmin({ children, fallback }: Props) {
  const { status, data } = useAuth();
  if (status === 'loading') return null;
  if (status === 'authorized' && data?.kind === 'admin') return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return (
    <span className="text-xs text-slate-500">
      관리자 전용. <Link href="/login" className="underline">로그인</Link>
    </span>
  );
}

