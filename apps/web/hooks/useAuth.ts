"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession, type Session } from '../services/auth';

export function useAuth() {
  const qc = useQueryClient();
  const query = useQuery<Session>({
    queryKey: ['auth', 'me'],
    queryFn: getSession,
    retry: false
  });

  const status: 'loading' | 'authorized' | 'unauthorized' = query.isLoading
    ? 'loading'
    : query.isSuccess
    ? 'authorized'
    : 'unauthorized';

  return { ...query, status, invalidate: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }) };
}
