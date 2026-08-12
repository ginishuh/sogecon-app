export const WEB_BASE_URL: string = process.env.WEB_BASE_URL ?? 'http://localhost:3000';

function resolveApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_WEB_API_BASE ??
    process.env.E2E_MOCK_API_CONTROL_URL ??
    'http://127.0.0.1:3001';
  return raw.replace(/\/$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();

const API_ORIGIN = new URL(API_BASE_URL).origin;

/** E2E mock/real API 요청 여부 — 포트 하드코딩 대신 빌드·실행 env를 따른다. */
export function isApiUrl(url: URL | string): boolean {
  const parsed = typeof url === 'string' ? new URL(url) : url;
  return parsed.origin === API_ORIGIN;
}
