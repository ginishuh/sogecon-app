"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/api';
import { useToast } from '../../components/toast';

type MemberRead = { id: number; email: string; name: string; cohort: number; major?: string | null; roles: string; visibility: 'all'|'cohort'|'private' };

export default function MePage() {
  const { status } = useAuth();
  const toast = useToast();
  const [me, setMe] = useState<MemberRead | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'authorized') {
      apiFetch<MemberRead>('/me/').then(setMe).catch(() => setMe(null));
    }
  }, [status]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) return;
    setBusy(true);
    try {
      const updated = await apiFetch<MemberRead>('/me/', { method: 'PUT', body: JSON.stringify({ name: me.name, major: me.major, visibility: me.visibility }) });
      setMe(updated);
      toast.show('저장되었습니다.', { type: 'success' });
    } catch {
      toast.show('저장에 실패했습니다.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="mb-4 text-xl font-semibold">내 정보</h2>
      {status === 'loading' ? (
        <p className="text-sm text-slate-500">로딩 중…</p>
      ) : status === 'unauthorized' ? (
        <p className="text-sm text-slate-600">로그인 후 이용하세요.</p>
      ) : !me ? (
        <p className="text-sm text-slate-600">정보를 불러오는 중…</p>
      ) : (
        <form onSubmit={onSave} className="flex flex-col gap-3 text-sm">
          <div>이메일: <b>{me.email}</b></div>
          <label>이름
            <input className="mt-1 w-full rounded border px-3 py-2" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} />
          </label>
          <label>전공
            <input className="mt-1 w-full rounded border px-3 py-2" value={me.major ?? ''} onChange={(e) => setMe({ ...me, major: e.target.value })} />
          </label>
          <label>공개 범위
            <select className="mt-1 w-full rounded border px-3 py-2" value={me.visibility} onChange={(e) => setMe({ ...me, visibility: e.target.value as MemberRead['visibility'] })}>
              <option value="all">전체</option>
              <option value="cohort">기수 한정</option>
              <option value="private">비공개</option>
            </select>
          </label>
          <button disabled={busy} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">저장</button>
        </form>
      )}
    </div>
  );
}
