"use client";

import { useAuth } from '../../hooks/useAuth';

export default function MePage() {
  const { status, data } = useAuth();
  return (
    <div className="p-6 max-w-2xl">
      <h2 className="mb-4 text-xl font-semibold">내 정보</h2>
      {status === 'loading' ? (
        <p className="text-sm text-slate-500">로딩 중…</p>
      ) : status === 'unauthorized' ? (
        <p className="text-sm text-slate-600">로그인 후 이용하세요.</p>
      ) : (
        <div className="text-sm">
          <div className="mb-2">이메일: <b>{data?.kind === 'member' ? data.email : data?.email}</b></div>
          <div className="text-slate-500">향후: 표시용 생일(양/음), 연락처, 공개범위 편집을 지원합니다.</div>
        </div>
      )}
    </div>
  );
}

