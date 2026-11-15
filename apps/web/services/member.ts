import { apiFetch } from '../lib/api';

export async function activate(payload: { token: string; password: string }): Promise<{ ok: string }> {
  return apiFetch<{ ok: string }>(`/auth/member/activate`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function changePassword(payload: { current_password: string; new_password: string }): Promise<{ ok: string }> {
  return apiFetch<{ ok: string }>(`/auth/member/change-password`, { method: 'POST', body: JSON.stringify(payload) });
}


export async function requestPasswordReset(payload: { student_id: string; email: string }): Promise<{ ok: string }> {
  return apiFetch<{ ok: string }>(`/auth/member/password-reset/request`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function confirmPasswordReset(payload: { token: string; password: string }): Promise<{ ok: string }> {
  return apiFetch<{ ok: string }>(`/auth/member/password-reset/confirm`, { method: 'POST', body: JSON.stringify(payload) });
}
