// @vitest-environment jsdom
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { sentryOptions } from '../lib/sentry-options';

const DSN = 'https://public@o0.ingest.sentry.io/1';
const FRAGMENT_TOKEN = 'reset_fragment_sentinel_7c6b';

const sent: string[] = [];

// 브라우저 번들에서 쓰는 실제 클라이언트 SDK(history 기반 navigation breadcrumb 포함)를 불러온다.
// package exports가 하위 경로를 막아 두어 설치 경로의 client 빌드를 직접 가져온다.
type ClientSdk = typeof import('@sentry/nextjs');
function loadClientSdk(): ClientSdk {
  const require = createRequire(import.meta.url);
  const pkgDir = path.dirname(require.resolve('@sentry/nextjs/package.json'));
  return require(path.join(pkgDir, 'build/cjs/index.client.js')) as ClientSdk;
}

let Sentry: ClientSdk;

describe('Sentry 브라우저 fragment 토큰 차단', () => {
  beforeAll(() => {
    Sentry = loadClientSdk();
    window.history.replaceState({}, '', `/reset-password#token=${FRAGMENT_TOKEN}`);
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
    Sentry.init({
      ...sentryOptions(),
      transport: () => ({
        send: async (envelope) => {
          sent.push(JSON.stringify(envelope));
          return {};
        },
        flush: async () => true,
      }),
    });
  });

  afterAll(async () => {
    await Sentry.close();
    vi.unstubAllEnvs();
  });

  it('주소에서 fragment를 지울 때 생긴 navigation 기록에 토큰을 남기지 않는다', async () => {
    window.history.replaceState({}, '', '/reset-password');
    Sentry.captureException(new Error('reset page failed after token read'));
    await Sentry.flush(2000);

    const body = sent.join('\n');
    expect(body).toContain('reset page failed after token read');
    expect(body).toContain('"category":"navigation"');
    expect(body).not.toContain(FRAGMENT_TOKEN);
  });
});
