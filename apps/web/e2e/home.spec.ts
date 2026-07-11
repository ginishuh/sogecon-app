import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { WEB_BASE_URL } from './utils/env';
import { setupDirectoryMocks } from './utils/mockApi';

let browser: Browser | null = null;
let page: Page | null = null;

async function waitForPathname(page: Page, pathname: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (new URL(page.url()).pathname === pathname) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`경로 이동 시간 초과: ${pathname} (현재 ${page.url()})`);
}

async function moveToNextBanner(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await page.evaluate(() => {
        const button = document.querySelector<HTMLButtonElement>('button[aria-label="다음 배너"]');
        if (!button) return false;
        button.click();
        return true;
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Execution context was destroyed')) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('홈 배너 상호작용 전 페이지 전환이 안정화되지 않았습니다.');
}

describe('Home (CDP E2E)', () => {
  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    page.on('pageerror', (err: Error) => console.log('[pageerror]', err.message));
  });

  afterAll(async () => {
    try {
      if (page) await page.close();
    } finally {
      if (browser) await browser.close();
    }
  });

  it('renders hero carousel and navigates to directory via quick action', async () => {
    if (!page) throw new Error('Puppeteer page not initialized');
    await setupDirectoryMocks(page);
    await page.goto(`${WEB_BASE_URL}/`, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => document.querySelector('section[aria-label="홈 배너"]') !== null,
      { timeout: 30000 }
    );
    const movedToNextBanner = await moveToNextBanner(page);
    if (movedToNextBanner) {
      await page.waitForFunction(() =>
        document.querySelector('button[aria-label="2번째 배너 보기"]')?.getAttribute('aria-current') === 'true'
      );
    }
    // 빠른 실행에서 /directory 이동
    await page.locator('a[aria-label="동문 수첩 바로가기"]').click();
    await waitForPathname(page, '/directory');
    await page.waitForSelector('fieldset[aria-label="기본 검색 필터"]');
    const url = page.url();
    expect(url).toContain('/directory');
  });
});
