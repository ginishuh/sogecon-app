"use client";

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { logoutAll } from '../services/auth';
import { useAuth } from '../hooks/useAuth';

export function HeaderAuth() {
  const { status, data, invalidate } = useAuth();
  const mut = useMutation({
    mutationFn: logoutAll,
    onSuccess: () => invalidate()
  });

  if (status === 'loading') return null;
  if (status === 'unauthorized') {
    return <Link href="/login" className="text-sm text-slate-600 hover:underline">로그인</Link>;
  }
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">
        {data?.kind === 'admin' ? '관리자' : '멤버'}
      </span>
      <span>{data?.email}</span>
      <button className="underline" onClick={() => mut.mutate()} disabled={mut.isPending}>
        로그아웃
      </button>
    </div>
  );
}
