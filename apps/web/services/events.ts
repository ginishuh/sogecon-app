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

export type RsvpCounts = {
  going: number;
  waitlist: number;
  cancel: number;
};

export type AdminEvent = Event & {
  rsvp_counts: RsvpCounts;
};

export async function listEvents(params: { limit?: number; offset?: number } = {}): Promise<Event[]> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiFetch<Event[]>(`/events/${qs ? `?${qs}` : ''}`);
}

export type AdminEventListResponse = {
  items: AdminEvent[];
  total: number;
};

export type AdminEventListParams = {
  limit?: number;
  offset?: number;
  q?: string;
  date_from?: string;
  date_to?: string;
  status?: 'upcoming' | 'ongoing' | 'ended';
};

export async function listAdminEvents(params: AdminEventListParams = {}): Promise<AdminEventListResponse> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  if (params.q) q.set('q', params.q);
  if (params.date_from) q.set('date_from', params.date_from);
  if (params.date_to) q.set('date_to', params.date_to);
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return apiFetch<AdminEventListResponse>(`/admin/events/${qs ? `?${qs}` : ''}`);
}

export async function getEvent(id: number): Promise<Event> {
  return apiFetch<Event>(`/events/${id}`);
}

export type RSVPLiteral = 'going' | 'waitlist' | 'cancel';

export async function upsertEventRsvp(
  eventId: number,
  memberId: number,
  status: RSVPLiteral
) {
  return apiFetch(`/events/${eventId}/rsvp`, {
    method: 'POST',
    body: JSON.stringify({ member_id: memberId, status })
  });
}

export async function createEvent(payload: {
  title: string;
  starts_at: string;
  ends_at: string;
  location: string;
  capacity: number;
}): Promise<Event> {
  return apiFetch<Event>(`/events/`, { method: 'POST', body: JSON.stringify(payload) });
}

export type UpdateEventPayload = {
  title?: string;
  starts_at?: string;
  ends_at?: string;
  location?: string;
  capacity?: number;
};

export async function updateAdminEvent(id: number, payload: UpdateEventPayload): Promise<Event> {
  return apiFetch<Event>(`/admin/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminEvent(id: number): Promise<{ deleted_id: number }> {
  // 204 반환이지만 호환을 위해 최소 객체를 기대
  await apiFetch<void>(`/admin/events/${id}`, { method: 'DELETE' });
  return { deleted_id: id };
}
