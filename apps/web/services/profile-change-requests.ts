import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type ProfileChangeRequestRead = Schema<'ProfileChangeRequestRead'>;
export type ProfileChangeRequestStatus = ProfileChangeRequestRead['status'];

export type ProfileChangeRequestListResponse =
  Schema<'ProfileChangeRequestListResponse'>;

export type ProfileChangeRequestListParams = {
  limit?: number;
  offset?: number;
  status?: ProfileChangeRequestStatus;
  member_id?: number;
};

export async function listProfileChangeRequests(
  params: ProfileChangeRequestListParams = {}
): Promise<ProfileChangeRequestListResponse> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  if (params.status) q.set('status', params.status);
  if (params.member_id != null) q.set('member_id', String(params.member_id));
  const qs = q.toString();
  return apiFetch<ProfileChangeRequestListResponse>(
    `/admin/profile-change-requests/${qs ? `?${qs}` : ''}`
  );
}

export async function approveProfileChangeRequest(
  requestId: number
): Promise<ProfileChangeRequestRead> {
  return apiFetch<ProfileChangeRequestRead>(
    `/admin/profile-change-requests/${requestId}/approve`,
    { method: 'POST' }
  );
}

export async function rejectProfileChangeRequest(
  requestId: number,
  reason: string
): Promise<ProfileChangeRequestRead> {
  return apiFetch<ProfileChangeRequestRead>(
    `/admin/profile-change-requests/${requestId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
}
