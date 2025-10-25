"use client";

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
