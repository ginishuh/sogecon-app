"use client";

import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/toast';
import { useQuery } from '@tanstack/react-query';
import { AdminAuthState } from '../../../components/admin-auth-state';
import { Button } from '../../../components/ui/button';
import { FIELD_CONTROL } from '../../../components/ui/styles';
import { hasPermissionSession } from '../../../lib/rbac';
import {
  getNotificationStats,
  getSendLogs,
  pruneSendLogs,
  sendNotification,
  type SendLog,
  type NotificationStats,
} from '../../../services/notifications';

type RangeOpt = '24h' | '7d' | '30d';

export function StatsBlock({ data, isLoading, isError, statsRange, setStatsRange, onRefresh }:{
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
      <div className="mb-3 flex flex-wrap items-end gap-3 text-sm text-text-secondary">
        <label className="grid gap-1" htmlFor="notification-stats-range">기간
          <select
            id="notification-stats-range"
            className={`${FIELD_CONTROL} min-w-28 text-sm`}
            value={statsRange}
            onChange={(e) => setStatsRange(e.target.value as RangeOpt)}
          >
            {(['24h','7d','30d'] as const).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <Button type="button" variant="secondary" onClick={onRefresh}>요약 새로고침</Button>
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

export function LogsBlock({ data, isLoading, isError, logLimit, setLogLimit }:{
  data?: SendLog[];
  isLoading: boolean;
  isError: boolean;
  logLimit: number;
  setLogLimit: (n: number) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-lg font-medium">최근 발송 로그</h3>
      <div className="mb-3 flex items-center gap-2 text-sm text-text-secondary">
        <label className="grid gap-1" htmlFor="notification-log-limit">표시 개수
          <select id="notification-log-limit" className={`${FIELD_CONTROL} min-w-28 text-sm`} value={logLimit} onChange={(e) => setLogLimit(parseInt(e.target.value, 10))}>
            {[20, 50, 100, 200].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
      {isLoading ? (
        <div className="text-sm text-text-muted">로딩 중…</div>
      ) : isError ? (
        <div className="text-sm text-state-error">로그 불러오기 실패</div>
      ) : (
        <div className="overflow-x-auto" role="region" aria-label="최근 발송 로그 표">
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
              {(data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-sm text-text-muted">
                    아직 발송 로그가 없습니다.
                  </td>
                </tr>
              ) : (data ?? []).map((r, i) => (
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

export function PrunePanel({ pruneDays, setPruneDays, busy, onPrune }:{
  pruneDays: number;
  setPruneDays: (n: number) => void;
  busy: boolean;
  onPrune: () => void;
}) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-lg font-medium">로그 정리</h3>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1 text-sm" htmlFor="notification-prune-days">
          보관 기간(일)
          <input
            id="notification-prune-days"
            type="number"
            min={1}
            className={`${FIELD_CONTROL} w-28 text-sm`}
            value={pruneDays}
            onChange={(e) => setPruneDays(Math.max(1, parseInt(e.target.value || '1', 10)))}
          />
        </label>
        <Button type="button" variant="danger" disabled={busy} onClick={onPrune}>오래된 로그 삭제</Button>
      </div>
    </div>
  );
}

export default function AdminNotificationsPage() {
  const auth = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [logLimit, setLogLimit] = useState(50);
  const [pruneDays, setPruneDays] = useState(30);
  const [statsRange, setStatsRange] = useState<'24h'|'7d'|'30d'>('7d');
  const canManageNotifications = auth.status === 'authorized'
    && hasPermissionSession(auth.data, 'admin_notifications');
  const stats = useQuery({
    queryKey: ['notify','stats', statsRange],
    queryFn: () => getNotificationStats(statsRange),
    staleTime: 10_000,
    enabled: canManageNotifications,
  });
  const logs = useQuery<SendLog[]>({
    queryKey: ['notify','logs', logLimit],
    queryFn: () => getSendLogs(logLimit),
    staleTime: 10_000,
    enabled: canManageNotifications,
  });

  if (auth.status !== 'authorized') {
    return <AdminAuthState status={auth.status} />;
  }
  if (!canManageNotifications) {
    return <div className="p-4 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>;
  }

  const onSend = async () => {
    setBusy(true);
    try {
      const payload = { title, body, url: url || undefined };
      const res = await sendNotification(payload);
      if (res.accepted === 0 && res.failed === 0) {
        toast.show('발송 대상이 없습니다. 로그인 사용자에서 알림을 다시 활성화해 주세요.', { type: 'info' });
      } else {
        toast.show(`발송 요청 완료: 성공 ${res.accepted}, 실패 ${res.failed}`, { type: res.failed > 0 ? 'error' : 'success' });
      }
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
      <div className="p-4 sm:p-6">
        <h2 className="mb-4 text-xl font-semibold">알림 발송</h2>
        <div className="mb-6 flex max-w-xl flex-col gap-3">
          <label className="text-sm" htmlFor="notification-title">제목
            <input id="notification-title" className={`${FIELD_CONTROL} mt-1`} placeholder="알림 제목을 입력하세요" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="text-sm" htmlFor="notification-body">내용
            <textarea id="notification-body" className={`${FIELD_CONTROL} mt-1 min-h-24 resize-y`} rows={3} placeholder="알림 내용을 입력하세요" value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <label className="text-sm" htmlFor="notification-url">URL(선택)
            <input id="notification-url" className={`${FIELD_CONTROL} mt-1`} placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !title.trim() || !body.trim()} onClick={onSend}>발송</Button>
            <Button type="button" variant="secondary" onClick={async () => { await stats.refetch(); await logs.refetch(); }}>새로고침</Button>
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
  );
}
