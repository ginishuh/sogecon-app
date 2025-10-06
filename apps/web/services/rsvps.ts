// RSVP 서비스(웹)

import { apiFetch } from '../lib/api';

export type RSVP = {
  member_id: number;
  event_id: number;
  status: 'going' | 'waitlist' | 'cancel';
};

export async function getRsvp(memberId: number, eventId: number): Promise<RSVP> {
  return apiFetch<RSVP>(`/rsvps/${memberId}/${eventId}`);
}

