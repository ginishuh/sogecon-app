"use client";

import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { RequireAdmin } from '../../../components/require-admin';
import { useToast } from '../../../components/toast';
import { apiFetch } from '../../../lib/api';
import { useQuery } from '@tanstack/react-query';
import { getNotificationStats, getSendLogs, type SendLog } from '../../../services/notifications';

export default function AdminNotificationsPage() {
  const { status } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState('테스트 알림');
  const [body, setBody] = useState('웹 푸시 경로 연결 확인');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const stats = useQuery({ queryKey: ['notify','stats'], queryFn: getNotificationStats, staleTime: 10_000 });
  const logs = useQuery<SendLog[]>({ queryKey: ['notify','logs'], queryFn: () => getSendLogs(50), staleTime: 10_000 });

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
    <RequireAdmin fallback={<div className="p-4 text-sm text-slate-600">관리자 전용입니다.</div>}>
    <div className="p-6">
      <h2 className="mb-4 text-xl font-semibold">테스트 알림 발송(Admin)</h2>
      <div className="mb-6 flex max-w-xl flex-col gap-3">
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
          <button
            type="button"
            className="ml-2 rounded border px-3 py-2 text-sm"
            onClick={async () => { await stats.refetch(); await logs.refetch(); }}
          >새로고침</button>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-lg font-medium">요약</h3>
        {stats.isLoading ? (
          <div className="text-sm text-slate-500">로딩 중…</div>
        ) : stats.isError ? (
          <div className="text-sm text-red-600">요약 불러오기 실패</div>
        ) : stats.data ? (
          <div className="text-sm text-slate-800">
            활성 구독: <b>{stats.data.active_subscriptions}</b> · 최근 성공: <b className="text-emerald-700">{stats.data.recent_accepted}</b> · 최근 실패: <b className="text-red-700">{stats.data.recent_failed}</b>
            <span className="ml-3 text-xs text-slate-500">암호화: {stats.data.encryption_enabled ? 'ON' : 'OFF'}</span>
          </div>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-lg font-medium">최근 발송 로그</h3>
        {logs.isLoading ? (
          <div className="text-sm text-slate-500">로딩 중…</div>
        ) : logs.isError ? (
          <div className="text-sm text-red-600">로그 불러오기 실패</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-2">시간</th>
                  <th className="p-2">결과</th>
                  <th className="p-2">상태코드</th>
                  <th className="p-2">엔드포인트(말미)</th>
                </tr>
              </thead>
              <tbody>
                {(logs.data ?? []).map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-2 font-mono text-xs text-slate-600">{r.created_at}</td>
                    <td className="p-2">{r.ok ? <span className="text-emerald-700">성공</span> : <span className="text-red-700">실패</span>}</td>
                    <td className="p-2">{r.status_code ?? '-'}</td>
                    <td className="p-2 font-mono text-xs">{r.endpoint_tail ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </RequireAdmin>
  );
}
