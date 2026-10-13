import type * as Sentry from '@sentry/nextjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sentryOptions } from '../lib/sentry-options';

const TOKEN = 'act_9f8e7d6c5b4a';

describe('sentryOptions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('DSN이 없으면 SDK를 끈다', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    expect(sentryOptions().enabled).toBe(false);
  });

  it('DSN이 있으면 운영 환경으로 켜고 기본 PII를 보내지 않는다', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/1');
    const options = sentryOptions();
    expect(options.enabled).toBe(true);
    expect(options.environment).toBe('prod');
    expect(options.sendDefaultPii).toBe(false);
  });

  it('오류 이벤트의 URL·쿼리·이동 기록에서 활성화 토큰을 지운다', () => {
    const event = {
      request: {
        url: `https://www.example.com/activate?token=${TOKEN}#form`,
        query_string: `token=${TOKEN}`,
      },
      breadcrumbs: [
        { category: 'navigation', data: { from: '/', to: `/activate?token=${TOKEN}` } },
        { category: 'fetch', data: { url: `https://api.example.com/x?token=${TOKEN}&page=2` } },
      ],
    } as Sentry.ErrorEvent;

    const sent = sentryOptions().beforeSend(event);

    expect(JSON.stringify(sent)).not.toContain(TOKEN);
    expect(sent.request?.url).toBe('https://www.example.com/activate?token=[Filtered]#form');
    expect(sent.breadcrumbs?.[1]?.data?.url).toBe(
      'https://api.example.com/x?token=[Filtered]&page=[Filtered]',
    );
  });

  it('스트리밍 span 이름·속성과 단독 이동 기록에서도 토큰을 지운다', () => {
    type Span = Parameters<ReturnType<typeof sentryOptions>['beforeSendSpan']>[0];
    const span = {
      trace_id: 't',
      span_id: 's',
      name: `/activate?token=${TOKEN}`,
      start_timestamp: 0,
      status: 'ok',
      is_segment: true,
      attributes: {
        'url.full': `https://www.example.com/activate?token=${TOKEN}`,
        'http.query': { value: `?token=${TOKEN}`, type: 'string' },
        'http.response.status_code': 200,
      },
    } as Span;
    const crumb = sentryOptions().beforeBreadcrumb({
      category: 'navigation',
      data: { to: `/activate?token=${TOKEN}` },
    });

    const sent = sentryOptions().beforeSendSpan(span);

    expect(JSON.stringify(sent)).not.toContain(TOKEN);
    expect(sent.attributes['http.response.status_code']).toBe(200);
    expect(JSON.stringify(crumb)).not.toContain(TOKEN);
  });
});
