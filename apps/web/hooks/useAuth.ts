"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession, type Session } from '../services/auth';

export function useAuth() {
  const qc = useQueryClient();
  // 세션 쿠키가 없으면 /auth/session 호출을 생략해 401 스팸과 CORS 노이즈를 줄인다.
  const hasSessionCookie = typeof document !== 'undefined' && document.cookie.split(';').some((c) => c.trim().startsWith('session='));
  const query = useQuery<Session>({
    queryKey: ['auth', 'me'],
    queryFn: getSession,
    enabled: hasSessionCookie,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60_000,
    gcTime: 5 * 60_000
  });

  const status: 'loading' | 'authorized' | 'unauthorized' = hasSessionCookie
    ? (query.isLoading ? 'loading' : query.isSuccess ? 'authorized' : 'unauthorized')
    : 'unauthorized';

  return { ...query, status, invalidate: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }) };
}
