type CspOptions = {
  nonce: string;
  relaxCsp: boolean;
  analyticsId?: string | null;
  apiBase?: string | null;
};

const LOCALHOST_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

function createBaseDirectives() {
  return new Map<string, Set<string>>([
    ['default-src', new Set(["'self'"])],
    ['img-src', new Set(["'self'", 'https:', 'data:'])],
    ['script-src', new Set(["'self'"])],
    ['style-src', new Set(["'self'", "'unsafe-inline'"])],
    ['connect-src', new Set(["'self'", 'https:'])],
    ['font-src', new Set(["'self'", 'data:'])],
    ['worker-src', new Set(["'self'"])],
    ['object-src', new Set(["'none'"])],
    ['base-uri', new Set(["'self'"])],
    ['frame-ancestors', new Set(["'none'"])],
  ]);
}

function allowAnalytics(directives: Map<string, Set<string>>, analyticsId?: string | null) {
  if (!analyticsId) {
    return;
  }
  directives.get('script-src')?.add('https://www.googletagmanager.com');
  directives.get('connect-src')?.add('https://www.google-analytics.com');
}

function allowApiBase(directives: Map<string, Set<string>>, apiBase?: string | null) {
  if (!apiBase) {
    return;
  }
  try {
    const apiUrl = new URL(apiBase);
    directives.get('connect-src')?.add(`${apiUrl.protocol}//${apiUrl.host}`);
  } catch {
    // 잘못된 URL은 무시
  }
}

function applyRelaxedDirectives(directives: Map<string, Set<string>>) {
  const scriptSrc = directives.get('script-src');
  scriptSrc?.add("'unsafe-inline'");
  scriptSrc?.add("'unsafe-eval'");
  scriptSrc?.add('wasm-unsafe-eval');
  scriptSrc?.add('blob:');

  const connectSrc = directives.get('connect-src');
  connectSrc?.add('ws:');
  LOCALHOST_ORIGINS.forEach((origin) => connectSrc?.add(origin));

  directives.get('img-src')?.add('blob:');
  directives.get('worker-src')?.add('blob:');
}

function applyNonce(directives: Map<string, Set<string>>, nonce: string) {
  directives.get('script-src')?.add(`'nonce-${nonce}'`);
}

function formatDirectives(directives: Map<string, Set<string>>) {
  return Array.from(directives.entries())
    .map(([key, values]) => `${key} ${Array.from(values).join(' ')}`)
    .join('; ');
}

/**
 * 요청 단위 CSP 지시어를 생성한다.
 *
 * @remarks
 * - 프로덕션에서는 `script-src`에 nonce를 부여하고, Next.js가 서버 사이드에서 삽입하는
 *   스타일 태그 호환을 위해 `style-src 'unsafe-inline'`을 유지한다. (Next 15 App Router는
 *   크리티컬 CSS와 폰트 FOUT 억제를 위해 인라인 스타일을 삽입함)
 * - relax 모드에서는 개발 편의를 위해 HMR/DevTools 관련 지시어를 추가한다.
 */
export function buildCspDirective({ nonce, relaxCsp, analyticsId, apiBase }: CspOptions): string {
  const directives = createBaseDirectives();
  allowAnalytics(directives, analyticsId);
  allowApiBase(directives, apiBase);

  if (relaxCsp) {
    applyRelaxedDirectives(directives);
  } else {
    applyNonce(directives, nonce);
  }

  return formatDirectives(directives);
}
