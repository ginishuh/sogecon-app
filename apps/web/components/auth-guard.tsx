"use client";

import { type ReactNode } from 'react';
import { useRequireAuth } from '../hooks/useAuth';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * 인증 필수 페이지를 감싸는 가드 컴포넌트.
 * 미인증(401/403) 시 로그인 페이지로 리다이렉트.
 * 네트워크/서버 에러 시 에러 메시지 표시.
 */
export function AuthGuard({ children, fallback }: Props) {
  const { status } = useRequireAuth();

  if (status === 'authorized') {
    return <>{children}</>;
  }

  if (status === 'error') {
    return (
      <div className="p-6 text-sm text-red-600">
        서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.
      </div>
    );
  }

  return (
    fallback ?? (
      <div className="p-6 text-sm text-slate-500">
        {status === 'loading' ? '로딩 중…' : '로그인 페이지로 이동 중…'}
      </div>
    )
  );
}
