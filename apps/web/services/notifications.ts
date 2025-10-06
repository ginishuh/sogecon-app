import { apiFetch } from '../lib/api';

export type SubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
  ua?: string;
  member_id?: number | null;
};

export async function saveSubscription(payload: SubscriptionPayload): Promise<void> {
  await apiFetch<void>('/notifications/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  await apiFetch<void>('/notifications/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint })
  });
}

