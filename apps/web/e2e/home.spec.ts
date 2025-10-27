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
    await page.goto(`${WEB_BASE_URL}/`, { waitUntil: 'networkidle0' });

    await page.waitForSelector('.hero-dots', { timeout: 60000 });
    // 빠른 실행에서 /directory 이동
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('a.home-quick-actions__item[href="/directory"]'),
    ]);
    const url = page.url();
    expect(url).toContain('/directory');
  });
});
