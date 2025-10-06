"use client";

import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/toast';
import { apiFetch } from '../../../lib/api';

export default function AdminNotificationsPage() {
  const { status } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState('테스트 알림');
  const [body, setBody] = useState('웹 푸시 경로 연결 확인');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  if (status !== 'authorized') {
    return <div className="p-4 text-sm text-slate-600">관리자 로그인이 필요합니다.</div>;
  }

  const onSend = async () => {
    setBusy(true);
    try {
      const payload = { title, body, url: url || undefined };
      const res = await apiFetch<{ accepted: number; failed: number }>(
        '/notifications/admin/notifications/test',
        { method: 'POST', body: JSON.stringify(payload) }
      );
      toast.show(`발송 요청 완료: 성공 ${res.accepted}, 실패 ${res.failed}`, { type: 'success' });
    } catch {
      toast.show('발송 중 오류가 발생했습니다.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="mb-4 text-xl font-semibold">테스트 알림 발송(Admin)</h2>
      <div className="flex max-w-xl flex-col gap-3">
        <label className="text-sm">제목
          <input className="mt-1 w-full rounded border px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="text-sm">내용
          <textarea className="mt-1 w-full rounded border px-3 py-2" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <label className="text-sm">URL(선택)
          <input className="mt-1 w-full rounded border px-3 py-2" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <div>
          <button disabled={busy} onClick={onSend} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">발송</button>
        </div>
      </div>
    </div>
  );
}
