import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type DirectMemberCreatePayload = Schema<'DirectMemberCreatePayload'>;
export type DirectMemberCreateResponse = Schema<'DirectMemberCreateResponse'>;
export type MemberRolesUpdatePayload = Schema<'MemberRolesUpdatePayload'>;
export type MemberRolesUpdateResponse = Schema<'MemberRolesUpdateResponse'>;
export type MemberRead = Schema<'MemberRead'>;

/** 관리자 직접 회원 생성 */
export async function createMemberDirect(
  payload: DirectMemberCreatePayload
): Promise<DirectMemberCreateResponse> {
  return apiFetch<DirectMemberCreateResponse>('/admin/members/', {
    method: 'POST',
    body: JSON.stringify(payload),
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
