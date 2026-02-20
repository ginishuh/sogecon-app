import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type TestNotificationPayload = Schema<'TestPushPayload'>;

// TODO: API가 구조화된 응답 스키마(TestPushResult 등)를 정의하면 Schema alias로 전환
export type TestNotificationResult = {
  accepted: number;
  failed: number;
};

export async function sendTestNotification(payload: TestNotificationPayload): Promise<TestNotificationResult> {
  return apiFetch<TestNotificationResult>('/notifications/admin/notifications/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type SubscriptionPayload = Schema<'SubscriptionPayload'>;

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

export type SendLog = Schema<'SendLogRead'>;

export type NotificationStats = Schema<'NotificationStats'>;

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
