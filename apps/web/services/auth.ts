import { apiFetch } from '../lib/api';

export type Me = { id: number; email: string };

export async function me(): Promise<Me> {
  return apiFetch<Me>('/auth/me');
}

export async function login(payload: { email: string; password: string }): Promise<{ ok: string }> {
  return apiFetch<{ ok: string }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

