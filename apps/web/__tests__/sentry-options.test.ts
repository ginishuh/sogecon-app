// @vitest-environment node
import * as Sentry from '@sentry/nextjs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { sentryOptions } from '../lib/sentry-options';

const DSN = 'https://public@o0.ingest.sentry.io/1';
const TOKEN = 'act_9f8e7d6c5b4a';
const MEMBER_NAME = '홍길동';
const EMAIL = 'member@example.com';
const SESSION = 'sess_5f4e3d2c';

// 실제 SDK가 전송 직전에 만든 envelope를 메모리로 받아 검사한다.
const sent: string[] = [];

function payload(): string {
  return sent.join('\n');
}

describe('Sentry Web 개인정보 차단', () => {
  beforeAll(() => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
    Sentry.init({
      ...sentryOptions(),
      tracesSampleRate: 1,
      transport: () => ({
        send: async (envelope) => {
          sent.push(JSON.stringify(envelope));
          return {};
        },
        flush: async () => true,
      }),
    });
  });

  afterEach(() => {
    sent.length = 0;
  });

  afterAll(async () => {
    await Sentry.close();
    vi.unstubAllEnvs();
  });

  it('DSN이 없으면 SDK를 끈다', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    expect(sentryOptions().enabled).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
  });

  it('서버 요청 오류에서 쿠키·Referer 토큰·임의 헤더·검색어를 보내지 않는다', async () => {
    Sentry.captureRequestError(
      new Error('directory render failed'),
      {
        path: `/directory?q=${encodeURIComponent(MEMBER_NAME)}`,
        method: 'GET',
        headers: {
          referer: `https://www.example.com/activate?token=${TOKEN}`,
          cookie: `session=${SESSION}`,
          'x-member-email': EMAIL,
          'user-agent': 'Mozilla/5.0',
        },
      },
      { routerKind: 'App Router', routePath: '/directory', routeType: 'render' },
    );
    await Sentry.flush(2000);

    const body = payload();
    expect(body).toContain('directory render failed');
    for (const secret of [TOKEN, SESSION, EMAIL, MEMBER_NAME, encodeURIComponent(MEMBER_NAME)]) {
      expect(body).not.toContain(secret);
    }
  });

  it('스트리밍 span의 이름·쿼리 속성·헤더 배열에서 토큰과 검색어를 지운다', async () => {
    Sentry.startSpan(
      {
        name: `GET /activate?token=${TOKEN}`,
        attributes: {
          'url.full': `https://www.example.com/directory?q=${MEMBER_NAME}`,
          'url.query': `q=${MEMBER_NAME}`,
          'http.request.header.referer': [`https://www.example.com/activate?token=${TOKEN}`],
          'http.response.status_code': 200,
        },
      },
      () => undefined,
    );
    await Sentry.flush(2000);

    const body = payload();
    expect(body).toContain('GET /activate');
    expect(body).not.toContain(TOKEN);
    expect(body).not.toContain(MEMBER_NAME);
  });
});
