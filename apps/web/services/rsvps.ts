// RSVP 서비스(웹)

import { apiFetch } from '../lib/api';
import { ApiError } from '../lib/api';
import type { Schema } from './_dto';

export type RSVP = Schema<'RSVPRead'>;

export async function getRsvp(memberId: number, eventId: number): Promise<RSVP> {
  return apiFetch<RSVP>(`/rsvps/${memberId}/${eventId}`);
}

/** 신청 기록 없음(404)은 정상적인 미신청 상태로만 변환한다. */
export async function getOptionalRsvp(memberId: number, eventId: number): Promise<RSVP | null> {
  try {
    return await getRsvp(memberId, eventId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.code === 'rsvp_not_found') return null;
    throw error;
  }
}
