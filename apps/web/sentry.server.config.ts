import * as Sentry from '@sentry/nextjs';

import { sentryOptions } from './lib/sentry-options';

const options = sentryOptions();

Sentry.init({
  ...options,
  // 로그인·가입·문의 요청 본문에는 비밀번호와 연락처가 들어 있어 첨부하지 않는다.
  integrations: [...options.integrations, Sentry.httpIntegration({ maxRequestBodySize: 'none' })],
});
