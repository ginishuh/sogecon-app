"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession, type Session } from '../services/auth';
import { ApiError } from '../lib/api';

export type AuthStatus = 'loading' | 'authorized' | 'unauthorized' | 'error';

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

  // 에러 타입에 따라 상태 분기: 401/403만 unauthorized, 그 외는 error
  const status: AuthStatus = (() => {
    if (query.isLoading) return 'loading';
    if (query.isSuccess) return 'authorized';
    if (query.isError) {
      const err = query.error;
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        return 'unauthorized';
      }
      // 네트워크 에러, 500 등은 error 상태로 분리
      return 'error';
    }
    return 'loading';
  })();

  return { ...query, status, invalidate: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }) };
}

/**
 * 인증 필수 페이지용 훅.
 * 미인증(401/403) 시에만 로그인 페이지로 리다이렉트.
 * 네트워크/서버 에러는 리다이렉트하지 않고 error 상태 반환.
 * @returns { status, session, error } - 상태에 따른 정보
 */
export function useRequireAuth() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    // 401/403 인증 에러일 때만 리다이렉트
    if (auth.status === 'unauthorized') {
      router.replace('/login');
    }
  }, [auth.status, router]);

  return {
    status: auth.status,
    session: auth.status === 'authorized' ? auth.data : undefined,
    error: auth.status === 'error' ? auth.error : undefined,
  };
}
