// 공통 API 클라이언트 래퍼
// - fetch 옵션 통일, 에러 포맷 처리, BASE_URL 주입

// API 기본 호스트는 가능한 한 현재 호스트를 따릅니다(포트만 3001 고정).
// 환경변수에 localhost/127.0.0.1이 들어있으면 모바일/원격에서 동작하지 않으므로 무시하고 현재 호스트를 사용합니다.
function resolveApiBase(): string {
  const envBase = process.env.NEXT_PUBLIC_WEB_API_BASE;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (!envBase) return `http://${h}:3001`;
    const isLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(envBase);
    if (isLocal) return `http://${h}:3001`;
    return envBase;
  }
  // 서버 사이드에서는 env 우선, 없으면 localhost 사용
  return envBase ?? 'http://localhost:3001';
}
export const API_BASE = resolveApiBase();

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
