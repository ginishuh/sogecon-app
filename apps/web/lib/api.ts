// 공통 API 클라이언트 래퍼
// - fetch 옵션 통일, 에러 포맷 처리, BASE_URL 주입

export const API_BASE = process.env.NEXT_PUBLIC_WEB_API_BASE ?? 'http://localhost:3001';

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

export async function apiFetch<T>(path: string, init?: RequestInit & { method?: HttpMethod }): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    // 세션 쿠키 기반 인증을 위해 크리덴셜 포함
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    // Problem Details(JSON) 시도 후 텍스트로 폴백
    try {
      const problem = (await res.json()) as ProblemDetails;
      const msg = problem.detail || problem.title || `HTTP ${res.status}`;
      // JSON 파싱이 성공했다면 서버가 제공한 code를 보존하여 UI 매핑이 가능하도록 함
      throw new ApiError(problem.status ?? res.status, msg, problem.code);
    } catch (e) {
      // 위에서 던진 ApiError는 그대로 재전파
      if (e instanceof ApiError) throw e;
      const text = await res.text().catch(() => '');
      throw new ApiError(res.status, text || `HTTP ${res.status}`);
    }
  }
  return (await res.json()) as T;
}
