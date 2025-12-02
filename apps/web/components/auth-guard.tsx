"use client";

import { type ReactNode } from 'react';
import { useRequireAuth } from '../hooks/useAuth';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * 인증 필수 페이지를 감싸는 가드 컴포넌트.
 * 미인증 시 로그인 페이지로 리다이렉트.
 */
export function AuthGuard({ children, fallback }: Props) {
  const { status } = useRequireAuth();

  if (status !== 'authorized') {
    return (
      fallback ?? (
        <div className="p-6 text-sm text-slate-500">
          {status === 'loading' ? '로딩 중…' : '로그인 페이지로 이동 중…'}
        </div>
      )
    );
  }

  return <>{children}</>;
}
