import { apiFetch } from '../lib/api';

export type RoleGrade = 'member' | 'admin' | 'super_admin';

export type AdminUserRolesRead = {
  student_id: string;
  email?: string | null;
  name?: string | null;
  has_member_record: boolean;
  roles: string[];
  grade: RoleGrade;
  permissions: string[];
};

export type AdminUserRolesListResponse = {
  items: AdminUserRolesRead[];
  total: number;
};

export async function listAdminUsers(): Promise<AdminUserRolesListResponse> {
  return apiFetch<AdminUserRolesListResponse>('/admin/admin-users/');
}

export type AdminUserRolesUpdateResponse = {
  updated: AdminUserRolesRead;
  decided_by_student_id: string;
};

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
