"use client";

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

type Props = { children: ReactNode; fallback?: ReactNode };

export function RequireMember({ children, fallback }: Props) {
  const { status, data } = useAuth();
  const pathname = usePathname();
  if (status === 'loading') return null;
  // 백엔드 require_member는 관리자도 통과시킴 → 프론트도 동일하게 허용
  if (status === 'authorized' && (data?.kind === 'member' || data?.kind === 'admin')) return <>{children}</>;
  if (pathname === '/login') return null; // 로그인 페이지에서는 안내/링크 숨김
  // 기본은 렌더링하지 않음(명시 fallback 전달 시에만 노출)
  if (fallback !== undefined) return <>{fallback}</>;
  return null;
}
