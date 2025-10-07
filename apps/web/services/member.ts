import { apiFetch } from '../lib/api';

export async function activate(payload: { token: string; password: string }): Promise<{ ok: string }> {
  return apiFetch<{ ok: string }>(`/auth/member/activate`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function changePassword(payload: { current_password: string; new_password: string }): Promise<{ ok: string }> {
  return apiFetch<{ ok: string }>(`/auth/member/change-password`, { method: 'POST', body: JSON.stringify(payload) });
}

