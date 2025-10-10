import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { WEB_BASE_URL } from './utils/env';

let browser: Browser;
let page: Page;

function getSearch(urlString: string): URLSearchParams {
  const u = new URL(urlString);
  return u.searchParams;
}

describe('Directory URL sync (CDP E2E)', () => {
  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: 'new' });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await page.close();
    await browser.close();
  });

  it('updates query string when typing filters and changing sort', async () => {
    await page.goto(`${WEB_BASE_URL}/directory`, { waitUntil: 'domcontentloaded' });

    // 필터 UI가 보이는지 확인
    await page.waitForSelector('fieldset[aria-label="디렉터리 검색 필터"]');

    // 검색어 입력 → URL q 파라미터 동기화
    const qInput = await page.$('input[aria-label="검색어"]');
    expect(qInput).not.toBeNull();
    await qInput!.click({ clickCount: 3 });
    await qInput!.type('kim');

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
    const [resetBtn] = await page.$x("//button[contains(., '필터 초기화')]");
    expect(resetBtn).toBeTruthy();
    await resetBtn!.click();

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

