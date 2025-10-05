// 행사 도메인 서비스 계층(프런트)

import { apiFetch } from '../lib/api';

export type Event = {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string;
  capacity: number;
};

export async function listEvents(params: { limit?: number; offset?: number } = {}): Promise<Event[]> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiFetch<Event[]>(`/events${qs ? `?${qs}` : ''}`);
}

