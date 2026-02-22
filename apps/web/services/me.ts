import { API_BASE, apiFetch } from '../lib/api';
import type { Schema } from './_dto';

type MemberDto = Schema<'MemberRead'>;
type ProfileChangeRequestRead = Schema<'ProfileChangeRequestRead'>;

export async function getMe(): Promise<MemberDto> {
  return apiFetch<MemberDto>('/me/');
}

export async function updateMe(payload: Record<string, unknown>): Promise<MemberDto> {
  return apiFetch<MemberDto>('/me/', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateAvatar(formData: FormData): Promise<MemberDto> {
  return apiFetch<MemberDto>('/me/avatar', {
    method: 'POST',
    body: formData,
  });
}

export async function createChangeRequest(payload: {
  field_name: 'name' | 'cohort';
  new_value: string;
}): Promise<ProfileChangeRequestRead> {
  return apiFetch<ProfileChangeRequestRead>('/me/change-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listMyChangeRequests(): Promise<ProfileChangeRequestRead[]> {
  return apiFetch<ProfileChangeRequestRead[]>('/me/change-requests');
}

export type { MemberDto, ProfileChangeRequestRead };
export { API_BASE };
