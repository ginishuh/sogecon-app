// RSVP 서비스(웹)

import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type RSVP = Schema<'RSVPRead'>;

export async function getRsvp(memberId: number, eventId: number): Promise<RSVP> {
  return apiFetch<RSVP>(`/rsvps/${memberId}/${eventId}`);
}
