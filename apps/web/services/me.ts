import { API_BASE, apiFetch } from '../lib/api';
import type { Schema } from './_dto';

type MemberDto = Schema<'MemberRead'>;

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

export type { MemberDto };
export { API_BASE };
