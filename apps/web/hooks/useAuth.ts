"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { me, type Me } from '../services/auth';
import { ApiError } from '../lib/api';

export function useAuth() {
  const qc = useQueryClient();
  const query = useQuery<Me>({
    queryKey: ['auth', 'me'],
    queryFn: me,
    retry: false
  });

  const status: 'loading' | 'authorized' | 'unauthorized' = query.isLoading
    ? 'loading'
    : query.isSuccess
    ? 'authorized'
    : 'unauthorized';

  return { ...query, status, invalidate: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }) };
}

