import { API_BASE, apiFetch } from '../lib/api';
import type { Schema } from './_dto';
import type { ProfilePayload } from '../app/me/validation';

type MemberDto = Schema<'MemberRead'>;
type ProfileChangeRequestRead = Schema<'ProfileChangeRequestRead'>;
type DirectoryViewRequestRead = Schema<'DirectoryViewRequestRead'>;

export async function getMe(): Promise<MemberDto> {
  return apiFetch<MemberDto>('/me/');
}

export async function updateMe(payload: ProfilePayload): Promise<MemberDto> {
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

export async function listIncomingViewRequests(): Promise<DirectoryViewRequestRead[]> {
  return apiFetch<DirectoryViewRequestRead[]>('/me/view-requests');
}

export async function acceptViewRequest(requestId: number): Promise<DirectoryViewRequestRead> {
  return apiFetch<DirectoryViewRequestRead>(`/me/view-requests/${requestId}/accept`, {
    method: 'POST',
  });
}

export async function declineViewRequest(requestId: number): Promise<DirectoryViewRequestRead> {
  return apiFetch<DirectoryViewRequestRead>(`/me/view-requests/${requestId}/decline`, {
    method: 'POST',
  });
}

export async function revokeViewRequest(requestId: number): Promise<DirectoryViewRequestRead> {
  return apiFetch<DirectoryViewRequestRead>(`/me/view-requests/${requestId}/revoke`, {
    method: 'POST',
  });
}

export async function submitDirectoryConsent(visibility: MemberDto['visibility']): Promise<MemberDto> {
  return apiFetch<MemberDto>('/me/directory-consent', {
    method: 'POST',
    body: JSON.stringify({ visibility }),
  });
}

export type { MemberDto, ProfileChangeRequestRead, DirectoryViewRequestRead };
export { API_BASE };
