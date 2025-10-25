"use client";

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAll } from '../services/auth';
import { useAuth } from '../hooks/useAuth';

export function HeaderAuth() {
  const { status, data, invalidate } = useAuth();
  const pathname = usePathname();
  const mut = useMutation({
    mutationFn: logoutAll,
    onSuccess: () => invalidate()
  });

  if (status === 'loading') return null;
  if (status === 'unauthorized') {
    if (pathname === '/login') return null; // 로그인 페이지에서는 헤더 링크 숨김
    return <Link href="/login" className="text-sm text-slate-600 hover:underline">로그인</Link>;
  }
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">{data?.kind === 'admin' ? '관리자' : '멤버'}</span>
      {/* 기본 표시는 학번(student_id). 이메일을 노출하려면 data?.email로 교체 */}
      <span className="font-mono">{data?.student_id}</span>
      <button className="underline" onClick={() => mut.mutate()} disabled={mut.isPending}>
        로그아웃
      </button>
    </div>
  );
}
