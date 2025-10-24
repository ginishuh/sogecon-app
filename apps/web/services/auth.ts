import { apiFetch, ApiError } from '../lib/api';

export type AdminMe = { id: number; email: string };
export type MemberMe = { email: string };
export type Session = { kind: 'admin'; email: string; id: number } | { kind: 'member'; email: string };

export async function adminMe(): Promise<AdminMe> { return apiFetch<AdminMe>('/auth/me'); }
export async function memberMe(): Promise<MemberMe> { return apiFetch<MemberMe>('/auth/member/me'); }

export async function getSession(): Promise<Session> {
  try {
    const m = await memberMe();
    return { kind: 'member', email: m.email };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const a = await adminMe();
      return { kind: 'admin', email: a.email, id: a.id };
    }
    throw e;
  }
}

export async function login(payload: { student_id: string; password: string }): Promise<{ ok: string }> {
  return apiFetch<{ ok: string }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

export async function memberLogin(payload: { student_id: string; password: string }): Promise<{ ok: string }> {
  return apiFetch<{ ok: string }>('/auth/member/login', { method: 'POST', body: JSON.stringify(payload) });
}

export async function memberLogout(): Promise<void> {
  await apiFetch('/auth/member/logout', { method: 'POST' });
}

export async function logoutAll(): Promise<void> {
  // Try both, ignore 401s
  try { await memberLogout(); } catch {}
  try { await logout(); } catch {}
}
