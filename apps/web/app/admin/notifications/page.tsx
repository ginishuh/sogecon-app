"use client";

import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { RequirePermission } from '../../../components/require-permission';
import { useToast } from '../../../components/toast';
import { useQuery } from '@tanstack/react-query';
import {
  getNotificationStats,
  getSendLogs,
  pruneSendLogs,
  sendNotification,
  type SendLog,
  type NotificationStats,
} from '../../../services/notifications';

type RangeOpt = '24h' | '7d' | '30d';

function StatsBlock({ data, isLoading, isError, statsRange, setStatsRange, onRefresh }:{
  data?: NotificationStats;
  isLoading: boolean;
  isError: boolean;
  statsRange: RangeOpt;
  setStatsRange: (v: RangeOpt) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-lg font-medium">요약</h3>
      <div className="mb-2 flex items-center gap-2 text-xs text-text-secondary">
        <label className="flex items-center gap-1">기간
          <select
            className="rounded border px-2 py-1"
            value={statsRange}
            onChange={(e) => setStatsRange(e.target.value as RangeOpt)}
          >
            {(['24h','7d','30d'] as const).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <button type="button" className="rounded border px-2 py-1" onClick={onRefresh}>요약 새로고침</button>
      </div>
      {isLoading ? (
        <div className="text-sm text-text-muted">로딩 중…</div>
      ) : isError ? (
        <div className="text-sm text-state-error">요약 불러오기 실패</div>
      ) : data ? (
        <div className="text-sm text-text-primary">
          활성 구독: <b>{data.active_subscriptions}</b> · 최근 성공: <b className="text-state-success">{data.recent_accepted}</b> · 최근 실패: <b className="text-state-error">{data.recent_failed}</b>
          <span
            className={`ml-3 inline-flex items-center rounded px-2 py-0.5 text-xs ${data.encryption_enabled ? 'bg-state-success-subtle text-state-success ring-1 ring-state-success-ring' : 'bg-state-error-subtle text-state-error ring-1 ring-state-error-ring'}`}
            title="구독 at-rest 암호화 상태"
          >암호화 {data.encryption_enabled ? 'ON' : 'OFF'}</span>
          {typeof data.failed_404 === 'number' ? (
            <span className="ml-3 text-xs text-text-muted">실패 분포: 404 {data.failed_404} · 410 {data.failed_410 ?? 0} · 기타 {data.failed_other ?? 0}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LogsBlock({ data, isLoading, isError, logLimit, setLogLimit }:{
  data?: SendLog[];
  isLoading: boolean;
  isError: boolean;
  logLimit: number;
  setLogLimit: (n: number) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-lg font-medium">최근 발송 로그</h3>
      <div className="mb-2 flex items-center gap-2 text-xs text-text-secondary">
        <label className="flex items-center gap-1">표시 개수
          <select className="rounded border px-2 py-1" value={logLimit} onChange={(e) => setLogLimit(parseInt(e.target.value, 10))}>
            {[20, 50, 100, 200].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
      {isLoading ? (
        <div className="text-sm text-text-muted">로딩 중…</div>
      ) : isError ? (
        <div className="text-sm text-state-error">로그 불러오기 실패</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b bg-surface-raised">
                <th className="p-2">시간</th>
                <th className="p-2">결과</th>
                <th className="p-2">상태코드</th>
                <th className="p-2">엔드포인트(말미)</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-2 font-mono text-xs text-text-secondary">{r.created_at}</td>
                  <td className="p-2">{r.ok ? <span className="text-state-success">성공</span> : <span className="text-state-error">실패</span>}</td>
                  <td className="p-2">{r.status_code ?? '-'}</td>
                  <td className="p-2 font-mono text-xs">{r.endpoint_tail ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PrunePanel({ pruneDays, setPruneDays, busy, onPrune }:{
  pruneDays: number;
  setPruneDays: (n: number) => void;
  busy: boolean;
  onPrune: () => void;
}) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-lg font-medium">로그 정리</h3>
      <div className="flex items-center gap-2 text-sm">
        <label className="text-sm">
          보관 기간(일)
          <input
            type="number"
            min={1}
            className="ml-2 w-24 rounded border px-2 py-1"
            value={pruneDays}
            onChange={(e) => setPruneDays(Math.max(1, parseInt(e.target.value || '1', 10)))}
          />
        </label>
        <button disabled={busy} onClick={onPrune} className="rounded border px-3 py-1.5 text-sm disabled:opacity-50">오래된 로그 삭제</button>
      </div>
    </div>
  );
}

export default function AdminNotificationsPage() {
  const { status } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [logLimit, setLogLimit] = useState(50);
  const [pruneDays, setPruneDays] = useState(30);
  const [statsRange, setStatsRange] = useState<'24h'|'7d'|'30d'>('7d');
  const stats = useQuery({ queryKey: ['notify','stats', statsRange], queryFn: () => getNotificationStats(statsRange!), staleTime: 10_000 });
  const logs = useQuery<SendLog[]>({ queryKey: ['notify','logs', logLimit], queryFn: () => getSendLogs(logLimit), staleTime: 10_000 });

  if (status !== 'authorized') {
    return <div className="p-4 text-sm text-text-secondary">관리자 로그인이 필요합니다.</div>;
  }

  const onSend = async () => {
    setBusy(true);
    try {
      const payload = { title, body, url: url || undefined };
      const res = await sendNotification(payload);
      toast.show(`발송 요청 완료: 성공 ${res.accepted}, 실패 ${res.failed}`, { type: 'success' });
    } catch {
      toast.show('발송 중 오류가 발생했습니다.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onPrune = async () => {
    setBusy(true);
    try {
      const res = await pruneSendLogs(pruneDays);
      const before = res.before ? new Date(res.before).toLocaleString() : '';
      toast.show(`오래된 로그 ${res.deleted}건 삭제${before ? ` (기준: ${before})` : ''}`, { type: 'success' });
      await logs.refetch();
    } catch {
      toast.show('로그 정리 중 오류가 발생했습니다.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequirePermission
      permission="admin_notifications"
      fallback={<div className="p-4 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>}
    >
      <div className="p-6">
        <h2 className="mb-4 text-xl font-semibold">알림 발송</h2>
        <div className="mb-6 flex max-w-xl flex-col gap-3">
          <label className="text-sm">제목
            <input className="mt-1 w-full rounded border px-3 py-2" placeholder="알림 제목을 입력하세요" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="text-sm">내용
            <textarea className="mt-1 w-full rounded border px-3 py-2" rows={3} placeholder="알림 내용을 입력하세요" value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <label className="text-sm">URL(선택)
            <input className="mt-1 w-full rounded border px-3 py-2" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <div>
            <button disabled={busy || !title.trim() || !body.trim()} onClick={onSend} className="rounded bg-state-success px-4 py-2 text-white disabled:opacity-50">발송</button>
            <button type="button" className="ml-2 rounded border px-3 py-2 text-sm" onClick={async () => { await stats.refetch(); await logs.refetch(); }}>새로고침</button>
          </div>
        </div>

        <StatsBlock
          data={stats.data}
          isLoading={stats.isLoading}
          isError={!!stats.error}
          statsRange={statsRange}
          setStatsRange={setStatsRange}
          onRefresh={() => { void stats.refetch(); }}
        />

        <PrunePanel pruneDays={pruneDays} setPruneDays={setPruneDays} busy={busy} onPrune={onPrune} />

        <LogsBlock
          data={logs.data}
          isLoading={logs.isLoading}
          isError={!!logs.error}
          logLimit={logLimit}
          setLogLimit={setLogLimit}
        />
      </div>
    </RequirePermission>
  );
}
