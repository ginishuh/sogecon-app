"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession, type Session } from '../services/auth';

export function useAuth() {
  const qc = useQueryClient();
  const query = useQuery<Session>({
    queryKey: ['auth', 'me'],
    // 서버 신뢰: HttpOnly 쿠키는 document.cookie로 감지 불가하므로 항상 질의하고 401은 정상 흐름으로 취급
    queryFn: () => getSession(),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60_000,
    gcTime: 5 * 60_000
  });

  const status: 'loading' | 'authorized' | 'unauthorized' = query.isLoading
    ? 'loading'
    : query.isSuccess
      ? 'authorized'
      : 'unauthorized';

  return { ...query, status, invalidate: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }) };
}

/**
 * 인증 필수 페이지용 훅.
 * 미인증 시 로그인 페이지로 리다이렉트.
 * @returns { status, session } - 로딩 중이거나 리다이렉트 중이면 session은 undefined
 */
export function useRequireAuth() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (auth.status === 'unauthorized') {
      router.replace('/login');
    }
  }, [auth.status, router]);

  return {
    status: auth.status,
    session: auth.status === 'authorized' ? auth.data : undefined,
  };
}
