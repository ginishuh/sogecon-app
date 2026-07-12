import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { WEB_BASE_URL } from './utils/env';
import { setupDirectoryMocks } from './utils/mockApi';
import { configureMockServer } from './utils/mockServer';

let browser: Browser | null = null;
let page: Page | null = null;

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

  it('shows the same activity hierarchy and member action contract on mobile', async () => {
    if (!page) throw new Error('Puppeteer page not initialized');
    await configureMockServer('member');
    await setupDirectoryMocks(page);
    await page.goto(`${WEB_BASE_URL}/`, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => document.querySelector('section[aria-label="홈 배너"]') !== null,
      { timeout: 30000 }
    );
    const movedToNextBanner = await moveToNextBanner(page);
    expect(movedToNextBanner).toBe(true);
    await page.waitForFunction(() =>
      document.querySelector('button[aria-label="2번째 배너 보기"]')?.getAttribute('aria-current') === 'true'
    );
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('동문으로 이어가기')
        && text.includes('최근 활동')
        && text.includes('공지사항')
        && text.includes('행사안내')
        && text.includes('소식')
        && text.includes('함께 만드는 동문회');
    });
    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      oldMenuTile: document.body.innerText.includes('자유게시판 바로가기'),
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
    expect(layout.oldMenuTile).toBe(false);

    const directoryHref = await page.evaluate(
      () => document.querySelector<HTMLAnchorElement>('main a[href="/directory"]')?.getAttribute('href')
    );
    expect(directoryHref).toBe('/directory');
  });
});
