import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

import { WEB_BASE_URL } from './utils/env';
import { setLocalMockSession, setupDirectoryMocks } from './utils/mockApi';
import { configureMockServer } from './utils/mockServer';

let browser: Browser | null = null;
let page: Page | null = null;

describe('Admin post preview (CDP E2E)', () => {
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
  });

  afterAll(async () => {
    setLocalMockSession('member');
    try {
      if (page) await page.close();
    } finally {
      if (browser) await browser.close();
    }
  });

  it('admin_hero가 홈의 미발행 hero를 읽기 전용 preview까지 연다', async () => {
    if (!page) throw new Error('Puppeteer page not initialized');
    await configureMockServer('admin_hero');
    if (!process.env.E2E_MOCK_API_CONTROL_URL) {
      setLocalMockSession('admin_hero');
      await setupDirectoryMocks(page);
    }

    await page.goto(`${WEB_BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('section[aria-label="홈 배너"]');
    await page.waitForFunction(() => document.body.innerText.includes('관리자 미리보기'));

    const href = await page.$eval(
      'section[aria-label="홈 배너"] a[aria-label="E2E 관리자 초안 자세히 보기"]',
      (anchor) => anchor.getAttribute('href'),
    );
    expect(href).toBe('/admin/posts/42/preview');

    await page.click('section[aria-label="홈 배너"] a[aria-label="E2E 관리자 초안 자세히 보기"]');
    await page.waitForFunction(() => window.location.pathname === '/admin/posts/42/preview');
    await page.waitForFunction(() => document.body.innerText.includes('E2E 관리자 preview 본문'));
    expect(await page.$('a[href="/admin/posts/42/edit"]')).toBeNull();
  });

  it('익명 사용자는 같은 draft의 공개 상세에서 404를 받는다', async () => {
    if (!browser) throw new Error('Puppeteer browser not initialized');
    await configureMockServer('member');
    setLocalMockSession('member');
    const anonymousPage = await browser.newPage();
    try {
      const response = await anonymousPage.goto(`${WEB_BASE_URL}/posts/42`, {
        waitUntil: 'networkidle0',
      });
      expect(response?.status()).toBe(404);
    } finally {
      await anonymousPage.close();
    }
  });
});
