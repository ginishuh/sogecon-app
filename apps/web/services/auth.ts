import { apiFetch, ApiError } from '../lib/api';

// TODO: API에서 SessionRead 스키마를 정의하면 Schema<'SessionRead'>로 전환
//       현재 스키마가 Record<string, unknown>이라 수동 유지
export type Session = {
  kind: 'admin' | 'member';
  student_id: string;
  email: string;
  name: string;
  id?: number | null;
  roles: string[];
};

// 통합 세션 조회
export async function getSession(): Promise<Session> {
  return apiFetch<Session>('/auth/session');
}

export async function login(payload: { student_id: string; password: string }): Promise<{ ok: string }> {
  return apiFetch<{ ok: string }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

export async function logoutAll(): Promise<void> {
  // 통합 로그아웃으로 일원화 (레거시 키들도 서버에서 함께 삭제됨)
  try { await logout(); }
  catch (err) { if (!(err instanceof ApiError && err.status === 401)) throw err; }
}
