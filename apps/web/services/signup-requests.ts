import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type SignupRequestRead = Schema<'SignupRequestRead'>;
export type SignupRequestStatus = SignupRequestRead['status'];
export type SignupRequestCreatePayload = Schema<'SignupRequestCreate'>;
export type SignupRequestListResponse = Schema<'SignupRequestListResponse'>;
export type SignupActivationIssueResponse = Schema<'SignupActivationIssueResponse'>;
export type SignupActivationIssueLogRead = Schema<'SignupActivationIssueLogRead'>;
export type SignupActivationIssueLogListResponse = Schema<'SignupActivationIssueLogListResponse'>;

export async function createSignupRequest(
  payload: SignupRequestCreatePayload
): Promise<SignupRequestRead> {
  return apiFetch<SignupRequestRead>('/auth/member/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type SignupRequestListParams = {
  limit?: number;
  offset?: number;
  q?: string;
  status?: SignupRequestStatus;
};

export async function listAdminSignupRequests(
  params: SignupRequestListParams = {}
): Promise<SignupRequestListResponse> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  if (params.q) q.set('q', params.q);
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return apiFetch<SignupRequestListResponse>(`/admin/signup-requests/${qs ? `?${qs}` : ''}`);
}

export async function approveAdminSignupRequest(
  signupRequestId: number
): Promise<SignupActivationIssueResponse> {
  return apiFetch<SignupActivationIssueResponse>(
    `/admin/signup-requests/${signupRequestId}/approve`,
    { method: 'POST' }
  );
}

export async function reissueAdminSignupRequestActivationToken(
  signupRequestId: number
): Promise<SignupActivationIssueResponse> {
  return apiFetch<SignupActivationIssueResponse>(
    `/admin/signup-requests/${signupRequestId}/reissue-token`,
    { method: 'POST' }
  );
}

export async function listAdminSignupRequestActivationTokenLogs(
  signupRequestId: number,
  limit = 20
): Promise<SignupActivationIssueLogListResponse> {
  const q = new URLSearchParams();
  q.set('limit', String(limit));
  return apiFetch<SignupActivationIssueLogListResponse>(
    `/admin/signup-requests/${signupRequestId}/activation-token-logs?${q.toString()}`
  );
}

export async function rejectAdminSignupRequest(
  signupRequestId: number,
  reason: string
): Promise<SignupRequestRead> {
  return apiFetch<SignupRequestRead>(
    `/admin/signup-requests/${signupRequestId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
}
