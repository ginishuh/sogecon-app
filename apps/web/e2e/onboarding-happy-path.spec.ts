import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page, HTTPRequest } from 'puppeteer';
import { WEB_BASE_URL } from './utils/env';

let browser: Browser | null = null;
let page: Page | null = null;

const ACTIVATE_TOKEN = 'mock-activation-token';
type SignupStatus = 'pending' | 'approved';
type MockState = { signupStatus: SignupStatus };

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': WEB_BASE_URL,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  } as Record<string, string>;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

async function fillFieldByLabel(page: Page, labelText: string, value: string) {
  await page.evaluate(
    ({ labelText: text, value: nextValue }) => {
      const labels = Array.from(document.querySelectorAll('label'));
      const matched = labels.find((label) => label.textContent?.includes(text));
      if (!matched) throw new Error(`label not found: ${text}`);
      const el = matched.querySelector('input, textarea');
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
        throw new Error(`input/textarea not found: ${text}`);
      }
      el.focus();
      el.value = nextValue;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { labelText, value }
  );
}

async function setupOnboardingMocks(page: Page) {
  const state: MockState = { signupStatus: 'pending' };
  const routeResponders = createOnboardingRouteResponders(state);

  await page.setRequestInterception(true);

  page.on('request', async (request: HTTPRequest) => {
    try {
      const handled = await respondOnboardingApiRequest(request, routeResponders);
      if (handled) return;
      await request.continue();
    } catch {
      await request.continue();
    }
  });
}

function signupRequestPayload(status: SignupStatus) {
  return {
    id: 1,
    student_id: '20251234',
    email: 'new-member@example.com',
    name: '신규회원',
    cohort: 60,
    major: '경제학',
    phone: '010-1234-5678',
    note: '테스트 신청',
    status,
    requested_at: '2026-02-18T08:00:00Z',
    decided_at: status === 'approved' ? '2026-02-18T08:05:00Z' : null,
    activated_at: null,
    decided_by_student_id: status === 'approved' ? '__seed__admin' : null,
    reject_reason: null,
  };
}

function createOnboardingRouteResponders(state: MockState) {
  return {
    'GET /auth/session': () =>
      jsonResponse({
        kind: 'admin',
        student_id: '__seed__admin',
        email: 'admin@test.example.com',
        name: 'Admin',
        id: 1,
        roles: ['member', 'admin', 'super_admin', 'admin_signup', 'admin_roles'],
      }),
    'POST /auth/member/signup': () => {
      state.signupStatus = 'pending';
      return jsonResponse(signupRequestPayload('pending'), 201);
    },
    'GET /admin/signup-requests/': () =>
      jsonResponse({
        items: [signupRequestPayload(state.signupStatus)],
        total: 1,
      }),
    'POST /admin/signup-requests/1/approve': () => {
      state.signupStatus = 'approved';
      return jsonResponse({
        request: signupRequestPayload('approved'),
        activation_context: {
          signup_request_id: 1,
          student_id: '20251234',
          email: 'new-member@example.com',
          name: '신규회원',
          cohort: 60,
        },
        activation_token: ACTIVATE_TOKEN,
      });
    },
    'POST /auth/member/activate': () => jsonResponse({ ok: 'true' }),
  } as Record<string, () => ReturnType<typeof jsonResponse>>;
}

async function respondOnboardingApiRequest(
  request: HTTPRequest,
  routeResponders: Record<string, () => ReturnType<typeof jsonResponse>>
) {
  const url = new URL(request.url());
  if (url.port !== '3001') return false;

  if (request.method() === 'OPTIONS') {
    await request.respond({
      status: 204,
      headers: corsHeaders(),
      body: '',
    });
    return true;
  }

  const routeKey = `${request.method()} ${url.pathname}`;
  const responder = routeResponders[routeKey];
  if (responder) {
    await request.respond(responder());
    return true;
  }

  await request.respond(jsonResponse({ ok: true }));
  return true;
}

describe('Onboarding happy path (CDP E2E)', () => {
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    page.on('pageerror', (err: Error) => console.log('[pageerror]', err.message));
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'serviceWorker', { value: undefined });
    });
  });

  afterAll(async () => {
    try {
      if (page) await page.close();
    } finally {
      if (browser) await browser.close();
    }
  });

  it('signup -> admin approve -> activate 흐름이 동작한다', async () => {
    if (!page) throw new Error('Puppeteer page not initialized');

    await setupOnboardingMocks(page);

    await page.goto(`${WEB_BASE_URL}/signup`, { waitUntil: 'networkidle0' });
    await fillFieldByLabel(page, '학번', '20251234');
    await fillFieldByLabel(page, '이름', '신규회원');
    await fillFieldByLabel(page, '이메일', 'new-member@example.com');
    await fillFieldByLabel(page, '기수', '60');
    await fillFieldByLabel(page, '전공', '경제학');
    await fillFieldByLabel(page, '연락처', '010-1234-5678');
    await fillFieldByLabel(page, '메모', '테스트 신청');

    await page.click('button[type="submit"]');
    await page.waitForFunction(() => document.body.textContent?.includes('가입신청 완료'));

    await page.goto(`${WEB_BASE_URL}/admin/signup-requests`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.textContent?.includes('가입신청 심사'));

    const clickedApprove = await page.$$eval('button', (buttons) => {
      const target = buttons.find((button) => (button.textContent || '').includes('승인'));
      if (!target) return false;
      (target as HTMLElement).click();
      return true;
    });
    expect(clickedApprove).toBe(true);

    await page.waitForFunction(() => document.body.textContent?.includes('활성화 토큰 복사'));

    await page.goto(`${WEB_BASE_URL}/activate?token=${ACTIVATE_TOKEN}`, { waitUntil: 'networkidle0' });
    await fillFieldByLabel(page, '비밀번호', 'new-password-1234');
    await page.click('button[type="submit"]');

    await page.waitForFunction(() => document.body.textContent?.includes('로그인 상태입니다.'));
    expect(page.url()).toContain('/activate');
  });
});
