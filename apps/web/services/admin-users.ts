import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type AdminUserRolesRead = Schema<'AdminUserRolesRead'>;
export type RoleGrade = AdminUserRolesRead['grade'];
export type AdminUserRolesListResponse = Schema<'AdminUserRolesListResponse'>;
export type AdminUserRolesUpdateResponse = Schema<'AdminUserRolesUpdateResponse'>;
export type AdminUserCreatePayload = Schema<'AdminUserCreatePayload'>;
export type AdminUserCreateResponse = Schema<'AdminUserCreateResponse'>;

export async function listAdminUsers(): Promise<AdminUserRolesListResponse> {
  return apiFetch<AdminUserRolesListResponse>('/admin/admin-users/');
}

export async function createAdminUser(
  payload: AdminUserCreatePayload
): Promise<AdminUserCreateResponse> {
  return apiFetch<AdminUserCreateResponse>('/admin/admin-users/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function patchAdminUserRoles(
  studentId: string,
  roles: string[]
): Promise<AdminUserRolesUpdateResponse> {
  return apiFetch<AdminUserRolesUpdateResponse>(
    `/admin/admin-users/${studentId}/roles`,
    {
      method: 'PATCH',
      body: JSON.stringify({ roles }),
    }
  );
}
