import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { WEB_BASE_URL } from './utils/env';

let browser: Browser;
let page: Page;

describe('Home (CDP E2E)', () => {
  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: 'new' });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await page.close();
    await browser.close();
  });

  it('renders hero and navigates to directory via primary CTA', async () => {
    await page.goto(`${WEB_BASE_URL}/`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('h1#home-hero');
    const title = await page.$eval('h1#home-hero', (el) => el.textContent?.trim() ?? '');
    expect(title).toContain('한 번의 로그인');

    // 클릭 시 /directory 로 이동
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.click('a.home-hero__cta'),
    ]);
    const url = page.url();
    expect(url).toContain('/directory');
  });
});

