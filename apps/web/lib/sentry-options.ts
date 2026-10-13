import type * as Sentry from '@sentry/nextjs';

type InitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;
type Breadcrumb = Sentry.Breadcrumb;
type ErrorEvent = Sentry.ErrorEvent;
type StreamedSpan = Parameters<NonNullable<InitOptions['beforeSendSpan']>>[0];
type Integration = Extract<NonNullable<InitOptions['integrations']>, readonly unknown[]>[number];

// 운영 이미지 빌드에서만 DSN을 주입한다. 로컬·CI 빌드는 DSN이 없어 SDK가 꺼진다.
const TRACES_SAMPLE_RATE = 0.1;
const FILTERED = '[Filtered]';

// v11은 sendDefaultPii를 없애고 dataCollection 기본값으로 사용자·쿠키·헤더·쿼리·본문을 모두 수집한다.
// 회원 연락처·비밀번호·활성화 토큰이 오가므로 진단에 필요한 헤더만 남기고 나머지는 끈다.
const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { allow: ['accept', 'accept-language', 'content-type', 'user-agent'] },
    response: { allow: ['content-type'] },
  },
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
} satisfies NonNullable<InitOptions['dataCollection']>;

// 가입 활성화 토큰처럼 비밀값이 쿼리스트링으로 오가므로 모든 쿼리 값을 가린다.
export function scrubUrl(value: string): string {
  const queryStart = value.indexOf('?');
  if (queryStart < 0) return value;
  const hashStart = value.indexOf('#', queryStart);
  const query = value.slice(queryStart + 1, hashStart < 0 ? undefined : hashStart);
  const hash = hashStart < 0 ? '' : value.slice(hashStart);
  return `${value.slice(0, queryStart)}?${scrubQuery(query)}${hash}`;
}

// `?` 없이 쿼리만 담긴 값(`url.query`, `query_string`)도 같은 규칙으로 가린다.
function scrubQuery(query: string): string {
  if (!query) return query;
  return query
    .split('&')
    .map((pair) => {
      const separator = pair.indexOf('=');
      return separator < 0 ? FILTERED : `${pair.slice(0, separator)}=${FILTERED}`;
    })
    .join('&');
}

function isQueryKey(key: string): boolean {
  return /(^|[._])query(_string)?$/.test(key.toLowerCase());
}

function scrubValue(key: string, value: unknown): unknown {
  if (typeof value === 'string') return isQueryKey(key) ? scrubQuery(value) : scrubUrl(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(key, item));
  return value;
}

function scrubRecord(record: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    scrubbed[key] = scrubValue(key, value);
  }
  return scrubbed;
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    if (event.request.query_string) event.request.query_string = FILTERED;
    if (event.request.headers) {
      event.request.headers = scrubRecord(event.request.headers) as Record<string, string>;
    }
  }
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  if (event.contexts) {
    for (const [name, context] of Object.entries(event.contexts)) {
      if (context) event.contexts[name] = scrubRecord(context);
    }
  }
  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb);
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (!breadcrumb.data) return breadcrumb;
  return { ...breadcrumb, data: scrubRecord(breadcrumb.data) };
}

function scrubAttribute(key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return { ...value, value: scrubValue(key, (value as { value: unknown }).value) };
  }
  return scrubValue(key, value);
}

// v11 기본 traceLifecycle('stream')에서는 트랜잭션 대신 span 단위로 URL·헤더가 전송된다.
function scrubSpan(span: StreamedSpan): StreamedSpan {
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(span.attributes ?? {})) {
    attributes[key] = scrubAttribute(key, value);
  }
  return { ...span, name: scrubUrl(span.name), attributes: attributes as StreamedSpan['attributes'] };
}

// envelope 헤더의 trace.transaction(DSC)은 beforeSendSpan을 거치지 않아 별도로 가린다.
function scrubTraceHeaderIntegration(): Integration {
  return {
    name: 'SogeconScrubTraceHeader',
    setup(client) {
      client.on('createDsc', (dsc) => {
        if (dsc.transaction) dsc.transaction = scrubUrl(dsc.transaction);
      });
    },
  };
}

export function sentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: 'prod',
    tracesSampleRate: TRACES_SAMPLE_RATE,
    dataCollection: DATA_COLLECTION,
    integrations: [scrubTraceHeaderIntegration()],
    beforeSend: (event: ErrorEvent) => scrubEvent(event),
    beforeSendSpan: (span: StreamedSpan) => scrubSpan(span),
    beforeBreadcrumb: (breadcrumb: Breadcrumb) => scrubBreadcrumb(breadcrumb),
  } satisfies InitOptions;
}
