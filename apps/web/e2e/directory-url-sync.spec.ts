import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { WEB_BASE_URL } from './utils/env';
import { setupDirectoryMocks } from './utils/mockApi';
import type { ConsoleMessage } from 'puppeteer';

let browser: Browser | null = null;
let page: Page | null = null;

function getSearch(urlString: string): URLSearchParams {
  const u = new URL(urlString);
  return u.searchParams;
}

describe('Directory URL sync (CDP E2E)', () => {
  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.setBypassCSP(true);
    // E2E 안정화를 위해 SW 비활성화
    page.on('console', (msg: ConsoleMessage) => {
      console.log('[console]', msg.type(), msg.text());
    });
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

  it('updates query string when typing filters and changing sort', async () => {
    if (!page) throw new Error('Puppeteer page not initialized');
    await setupDirectoryMocks(page);
    await page.goto(`${WEB_BASE_URL}/directory`, { waitUntil: 'networkidle0' });

    // 필터 UI가 보이는지 확인(아코디언 내부)
    await page.waitForSelector('summary');
    await page.waitForSelector('fieldset[aria-label="수첩 검색 필터"]');

    // 검색어 입력 → URL q 파라미터 동기화
    const qInput = await page.$('input[aria-label="검색어"]');
    if (!qInput) throw new Error('검색어 입력 필드를 찾을 수 없습니다');
    await qInput.click({ clickCount: 3 });
    await qInput.type('kim');

    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get('q') === 'kim',
      { polling: 100, timeout: 5000 }
    );
    expect(getSearch(page.url()).get('q')).toBe('kim');

    // 정렬 옵션 변경 → URL sort 파라미터 동기화
    await page.select('select[aria-label="정렬 옵션"]', 'name');
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get('sort') === 'name',
      { polling: 100, timeout: 5000 }
    );
    expect(getSearch(page.url()).get('sort')).toBe('name');

    // 필터 초기화 → 쿼리 제거
    const clickedReset = await page.$$eval('button', (nodes) => {
      const btn = nodes.find((n) => (n.textContent || '').includes('필터 초기화')) as HTMLElement | undefined;
      if (!btn) return false;
      btn.click();
      return true;
    });
    expect(clickedReset).toBe(true);

    await page.waitForFunction(
      () => {
        const sp = new URL(window.location.href).searchParams;
        return !sp.get('q') && !sp.get('sort');
      },
      { polling: 100, timeout: 5000 }
    );
    const params = getSearch(page.url());
    expect(params.get('q')).toBeNull();
    expect(params.get('sort')).toBeNull();
  });
});
