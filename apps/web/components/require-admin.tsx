"use client";

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { isAdminSession } from '../lib/rbac';

type Props = { children: ReactNode; fallback?: ReactNode };

export function RequireAdmin({ children, fallback }: Props) {
  const { status, data } = useAuth();
  const pathname = usePathname();
  if (status === 'loading') return null;
  if (status === 'authorized' && isAdminSession(data)) return <>{children}</>;
  if (pathname === '/login') return null; // 로그인 페이지에서는 안내/링크 숨김
  // 기본은 아무 것도 렌더링하지 않음. 필요 시 명시적으로 fallback 전달
  if (fallback !== undefined) return <>{fallback}</>;
  return null;
}
