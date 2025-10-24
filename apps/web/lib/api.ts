// 공통 API 클라이언트 래퍼
// - fetch 옵션 통일, 에러 포맷 처리, BASE_URL 주입

// API 기본 호스트는 환경변수 없으면 현재 호스트를 따라갑니다(포트만 3001로 고정).
// 이렇게 하면 http://127.0.0.1:3000 에서 접속해도 쿠키 SameSite 기준으로 "같은 사이트"가 되어 세션이 동작합니다.
const defaultHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
export const API_BASE = process.env.NEXT_PUBLIC_WEB_API_BASE ?? `http://${defaultHost}:3001`;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ProblemDetails = {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  code?: string;
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(res: Response): Promise<never> {
  try {
    const problem = (await res.json()) as ProblemDetails;
    const msg = problem.detail || problem.title || `HTTP ${res.status}`;
    throw new ApiError(problem.status ?? res.status, msg, problem.code);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || `HTTP ${res.status}`);
  }
}

async function parseOk<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export async function apiFetch<T>(path: string, init?: RequestInit & { method?: HttpMethod }): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    cache: 'no-store',
  });
  return res.ok ? parseOk<T>(res) : parseError(res);
}
