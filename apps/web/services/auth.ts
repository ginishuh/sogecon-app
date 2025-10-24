import { apiFetch, ApiError } from '../lib/api';

export type AdminMe = { id: number; email: string };
export type MemberMe = { email: string };
export type Session = { kind: 'admin'; email: string; id: number } | { kind: 'member'; email: string };

export async function adminMe(): Promise<AdminMe> { return apiFetch<AdminMe>('/auth/me'); }
export async function memberMe(): Promise<MemberMe> { return apiFetch<MemberMe>('/auth/member/me'); }

export async function getSession(): Promise<Session> {
  try {
    const a = await adminMe();
    return { kind: 'admin', email: a.email, id: a.id };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const m = await memberMe();
      return { kind: 'member', email: m.email };
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
  // 두 세션 모두 시도하되, 401(세션 없음)은 무시하고 나머지는 전파
  try {
    await memberLogout();
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 401)) throw err;
  }
  try {
    await logout();
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 401)) throw err;
  }
}
