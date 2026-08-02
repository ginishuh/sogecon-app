// 공통 API 클라이언트 래퍼
// - fetch 옵션 통일, 에러 포맷 처리, BASE_URL 주입

const DEV_LIKE_ENVS = new Set(['development', 'test']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

type ApiBaseResolutionOptions = {
  publicBase?: string;
  internalBase?: string;
  isBrowser?: boolean;
  nodeEnv?: string;
  currentHostname?: string;
};

function isLoopbackUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return LOOPBACK_HOSTS.has(url.hostname.toLowerCase().replace(/^\[|\]$/g, ''));
  } catch {
    return false;
  }
}

function hostWithBrackets(hostname: string): string {
  return hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname;
}

function getBrowserValue(value: boolean | undefined): boolean {
  return value === undefined ? typeof window !== 'undefined' : value;
}

function getCurrentHostname(value: string | undefined, isBrowser: boolean): string {
  if (value) return value;
  if (isBrowser && typeof window !== 'undefined') return window.location.hostname;
  return 'localhost';
}

function getInternalBase(options: ApiBaseResolutionOptions, isBrowser: boolean): string | undefined {
  if (isBrowser) return undefined;
  const value = options.internalBase === undefined ? process.env.API_INTERNAL_URL : options.internalBase;
  return value?.trim() || undefined;
}

function resolvePublicBase(publicUrl: string, isBrowser: boolean, nodeEnv: string, currentHostname: string): string {
  const shouldRewriteLoopback = isBrowser && DEV_LIKE_ENVS.has(nodeEnv) && isLoopbackUrl(publicUrl);
  if (shouldRewriteLoopback) return `http://${hostWithBrackets(currentHostname)}:3001`;
  return publicUrl;
}

function resolveMissingBase(nodeEnv: string, currentHostname: string): string {
  if (!DEV_LIKE_ENVS.has(nodeEnv)) {
    throw new Error('NEXT_PUBLIC_WEB_API_BASE is required outside development and test environments.');
  }
  return `http://${hostWithBrackets(currentHostname)}:3001`;
}

export function resolveApiBase(options: ApiBaseResolutionOptions = {}): string {
  const isBrowser = getBrowserValue(options.isBrowser);
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const publicValue = options.publicBase === undefined ? process.env.NEXT_PUBLIC_WEB_API_BASE : options.publicBase;
  const publicUrl = publicValue?.trim();
  const internalBase = getInternalBase(options, isBrowser);
  const currentHostname = getCurrentHostname(options.currentHostname, isBrowser);

  if (internalBase) return internalBase;
  if (publicUrl) return resolvePublicBase(publicUrl, isBrowser, nodeEnv, currentHostname);
  return resolveMissingBase(nodeEnv, currentHostname);
}

export const API_BASE = resolveApiBase();

export function resolveApiAssetUrl(value: string): string {
  if (value.startsWith('/media/')) return `${API_BASE}${value}`;
  return value;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ProblemDetails = {
  type?: string;
  title?: string;
  status: number;
  detail?: unknown;
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
    const msg = detailToMessage(problem.detail) ?? problem.title ?? `HTTP ${res.status}`;
    throw new ApiError(problem.status ?? res.status, msg, problem.code);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || `HTTP ${res.status}`);
  }
}

function detailToMessage(detail: unknown): string | undefined {
  if (typeof detail === 'string' && detail) return detail;
  if (!Array.isArray(detail)) return undefined;

  for (const item of detail) {
    if (!isRecord(item)) continue;
    const message = item['msg'];
    if (typeof message !== 'string' || !message) continue;
    return message.replace(/^Value error,\s*/, '');
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

async function parseOk<T>(res: Response): Promise<T | void> {
  if (res.status === 204) return;
  return (await res.json()) as T;
}

// 모든 HTTP 메서드에서 T 반환 (DELETE 포함)
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { method?: HttpMethod }
): Promise<T>;

// 구현
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { method?: HttpMethod }
): Promise<T | void> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    cache: 'no-store',
  });
  return res.ok ? parseOk<T>(res) : parseError(res);
}
