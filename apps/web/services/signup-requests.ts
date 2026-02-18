import { apiFetch } from '../lib/api';

export type SignupRequestStatus = 'pending' | 'approved' | 'rejected' | 'activated';

export type SignupRequestRead = {
  id: number;
  student_id: string;
  email: string;
  name: string;
  cohort: number;
  major?: string | null;
  phone?: string | null;
  note?: string | null;
  status: SignupRequestStatus;
  requested_at?: string | null;
  decided_at?: string | null;
  activated_at?: string | null;
  decided_by_student_id?: string | null;
  reject_reason?: string | null;
};

export type SignupRequestCreatePayload = {
  student_id: string;
  email: string;
  name: string;
  cohort: number;
  major?: string | null;
  phone?: string | null;
  note?: string | null;
};

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

export type SignupRequestListResponse = {
  items: SignupRequestRead[];
  total: number;
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

export type SignupApproveResponse = {
  request: SignupRequestRead;
  activation_context: {
    signup_request_id: number;
    student_id: string;
    email: string;
    name: string;
    cohort: number;
  };
  activation_token: string;
};

export async function approveAdminSignupRequest(
  signupRequestId: number
): Promise<SignupApproveResponse> {
  return apiFetch<SignupApproveResponse>(
    `/admin/signup-requests/${signupRequestId}/approve`,
    { method: 'POST' }
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
