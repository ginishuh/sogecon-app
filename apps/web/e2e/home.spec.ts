import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { WEB_BASE_URL } from './utils/env';

let browser: Browser | null = null;
let page: Page | null = null;

describe('Home (CDP E2E)', () => {
  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  });

  afterAll(async () => {
    try {
      if (page) await page.close();
    } finally {
      if (browser) await browser.close();
    }
  });

  it('renders hero and navigates to directory via primary CTA', async () => {
    if (!page) throw new Error('Puppeteer page not initialized');
    await page.goto(`${WEB_BASE_URL}/`, { waitUntil: 'networkidle0' });

    await page.waitForSelector('h1#home-hero');
    const title = await page.$eval('h1#home-hero', (el) => el.textContent?.trim() ?? '');
    expect(title).toContain('한 번의 로그인');

    // 클릭 시 /directory 로 이동
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('a.home-hero__cta'),
    ]);
    const url = page.url();
    expect(url).toContain('/directory');
  });
});
