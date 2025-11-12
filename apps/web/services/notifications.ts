import { apiFetch } from '../lib/api';

export type SubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
  ua?: string;
};

export async function saveSubscription(payload: SubscriptionPayload): Promise<void> {
  await apiFetch<void>('/notifications/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  await apiFetch('/notifications/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint })
  });
}

export type SendLog = {
  created_at: string;
  ok: boolean;
  status_code: number | null;
  endpoint_tail: string | null;
};

export type NotificationStats = {
  active_subscriptions: number;
  recent_accepted: number;
  recent_failed: number;
  encryption_enabled: boolean;
  range?: '24h'|'7d'|'30d';
  failed_404?: number;
  failed_410?: number;
  failed_other?: number;
};

export async function getSendLogs(limit = 50): Promise<SendLog[]> {
  return apiFetch<SendLog[]>(`/notifications/admin/notifications/logs?limit=${limit}`);
}

export async function getNotificationStats(range: '24h'|'7d'|'30d' = '7d'): Promise<NotificationStats> {
  return apiFetch<NotificationStats>(`/notifications/admin/notifications/stats?range=${range}`);
}

export async function pruneSendLogs(olderThanDays: number): Promise<{ deleted: number; before?: string; older_than_days?: number }> {
  return apiFetch<{ deleted: number; before?: string; older_than_days?: number }>(
    '/notifications/admin/notifications/prune-logs',
    { method: 'POST', body: JSON.stringify({ older_than_days: olderThanDays }) }
  );
}
