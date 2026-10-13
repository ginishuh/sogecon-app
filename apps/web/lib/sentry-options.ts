import type * as Sentry from '@sentry/nextjs';

type InitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;
type Breadcrumb = Sentry.Breadcrumb;
type ErrorEvent = Sentry.ErrorEvent;
type StreamedSpan = Parameters<NonNullable<InitOptions['beforeSendSpan']>>[0];

// 운영 이미지 빌드에서만 DSN을 주입한다. 로컬·CI 빌드는 DSN이 없어 SDK가 꺼진다.
const TRACES_SAMPLE_RATE = 0.1;
const FILTERED = '[Filtered]';

// 가입 활성화 토큰처럼 비밀값이 쿼리스트링으로 오가므로 모든 쿼리 값을 가린다.
export function scrubUrl(value: string): string {
  const queryStart = value.indexOf('?');
  if (queryStart < 0) return value;
  const hashStart = value.indexOf('#', queryStart);
  const query = value.slice(queryStart + 1, hashStart < 0 ? undefined : hashStart);
  const hash = hashStart < 0 ? '' : value.slice(hashStart);
  const filtered = query
    .split('&')
    .map((pair) => {
      const separator = pair.indexOf('=');
      return separator < 0 ? pair : `${pair.slice(0, separator)}=${FILTERED}`;
    })
    .join('&');
  return `${value.slice(0, queryStart)}?${filtered}${hash}`;
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    if (event.request.query_string) event.request.query_string = FILTERED;
  }
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb);
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const data = breadcrumb.data;
  if (!data) return breadcrumb;
  const scrubbed: Record<string, unknown> = { ...data };
  for (const key of ['url', 'from', 'to']) {
    const value = scrubbed[key];
    if (typeof value === 'string') scrubbed[key] = scrubUrl(value);
  }
  return { ...breadcrumb, data: scrubbed };
}

function scrubAttribute(value: unknown): unknown {
  if (typeof value === 'string') return scrubUrl(value);
  if (value && typeof value === 'object' && 'value' in value) {
    const inner = (value as { value: unknown }).value;
    if (typeof inner === 'string') return { ...value, value: scrubUrl(inner) };
  }
  return value;
}

// v11 기본 traceLifecycle('stream')에서는 트랜잭션 대신 span 단위로 URL이 전송된다.
function scrubSpan(span: StreamedSpan): StreamedSpan {
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(span.attributes ?? {})) {
    attributes[key] = scrubAttribute(value);
  }
  return { ...span, name: scrubUrl(span.name), attributes: attributes as StreamedSpan['attributes'] };
}

export function sentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: 'prod',
    tracesSampleRate: TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
    beforeSend: (event: ErrorEvent) => scrubEvent(event),
    beforeSendSpan: (span: StreamedSpan) => scrubSpan(span),
    beforeBreadcrumb: (breadcrumb: Breadcrumb) => scrubBreadcrumb(breadcrumb),
  };
}
