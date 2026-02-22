import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type DirectMemberCreatePayload = Schema<'DirectMemberCreatePayload'>;
export type DirectMemberCreateResponse = Schema<'DirectMemberCreateResponse'>;
export type MemberRolesUpdatePayload = Schema<'MemberRolesUpdatePayload'>;
export type MemberRolesUpdateResponse = Schema<'MemberRolesUpdateResponse'>;
export type MemberRead = Schema<'MemberRead'>;
export type AdminMemberUpdate = Schema<'AdminMemberUpdate'>;

/** 관리자 직접 회원 생성 */
export async function createMemberDirect(
  payload: DirectMemberCreatePayload
): Promise<DirectMemberCreateResponse> {
  return apiFetch<DirectMemberCreateResponse>('/admin/members/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** 관리자용 회원 목록 (비공개 포함) */
export async function listMembersForAdmin(params: {
  q?: string;
  cohort?: number;
  sort?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<MemberRead[]> {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (params.cohort != null) usp.set('cohort', String(params.cohort));
  if (params.sort) usp.set('sort', params.sort);
  if (params.limit != null) usp.set('limit', String(params.limit));
  if (params.offset != null) usp.set('offset', String(params.offset));
  const qs = usp.toString();
  return apiFetch<MemberRead[]>(`/admin/members/${qs ? `?${qs}` : ''}`);
}

/** 관리자용 회원 수 */
export async function countMembersForAdmin(params: {
  q?: string;
  cohort?: number;
} = {}): Promise<number> {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (params.cohort != null) usp.set('cohort', String(params.cohort));
  const qs = usp.toString();
  const res = await apiFetch<{ count: number }>(`/admin/members/count${qs ? `?${qs}` : ''}`);
  return res.count;
}

/** 관리자 회원 정보 수정 (roles 제외) */
export async function updateMemberForAdmin(
  memberId: number,
  data: AdminMemberUpdate,
): Promise<MemberRead> {
  return apiFetch<MemberRead>(`/admin/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** 회원 역할 변경 */
export async function updateMemberRoles(
  memberId: number,
  roles: string[]
): Promise<MemberRolesUpdateResponse> {
  return apiFetch<MemberRolesUpdateResponse>(
    `/admin/members/${memberId}/roles`,
    {
      method: 'PATCH',
      body: JSON.stringify({ roles }),
    }
  );
}
