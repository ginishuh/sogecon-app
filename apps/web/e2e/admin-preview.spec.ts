import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

import { WEB_BASE_URL } from './utils/env';
import { setLocalMockSession, setupDirectoryMocks } from './utils/mockApi';
import { configureMockServer } from './utils/mockServer';

let browser: Browser | null = null;
let page: Page | null = null;

const heroPreviewLink =
  'section[aria-label="홈 배너"] a[aria-label="E2E 관리자 초안 자세히 보기"]';

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
    await configureMockServer('member');
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

    const href = await page.$eval(heroPreviewLink, (anchor) => anchor.getAttribute('href'));
    expect(href).toBe('/admin/posts/42/preview');

    await page.$eval(heroPreviewLink, (anchor) => {
      anchor.scrollIntoView({ block: 'center', inline: 'center' });
    });
    await page.waitForFunction((selector) => {
      const anchor = document.querySelector<HTMLElement>(selector);
      if (!anchor) return false;
      const rect = anchor.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    }, {}, heroPreviewLink);
    await page.click(heroPreviewLink);
    await page.waitForFunction(() => window.location.pathname === '/admin/posts/42/preview');
    await page.waitForFunction(() => document.body.innerText.includes('E2E 관리자 preview 본문'));
    expect(await page.$('a[href="/admin/posts/42/edit"]')).toBeNull();
  });

  it('관리자 목록에서 draft 수정 화면까지 실제 클릭으로 진입해 본문을 읽는다', async () => {
    if (!page) throw new Error('Puppeteer page not initialized');
    await configureMockServer('admin');
    if (!process.env.E2E_MOCK_API_CONTROL_URL) {
      setLocalMockSession('admin');
      await setupDirectoryMocks(page);
    }

    await page.goto(`${WEB_BASE_URL}/admin/posts`, { waitUntil: 'networkidle0' });
    const editLink = 'a[href="/admin/posts/42/edit"]';
    await page.waitForSelector(editLink);
    await page.click(editLink);
    await page.waitForFunction(() => window.location.pathname === '/admin/posts/42/edit');
    await page.waitForSelector('input[placeholder="글 제목을 입력하세요"]');

    expect(
      await page.$eval(
        'input[placeholder="글 제목을 입력하세요"]',
        (input) => (input as HTMLInputElement).value,
      ),
    ).toBe('E2E 관리자 초안');
    expect(
      await page.$eval(
        'textarea[placeholder="내용을 입력하세요"]',
        (textarea) => (textarea as HTMLTextAreaElement).value,
      ),
    ).toBe('E2E 관리자 preview 본문');
  });

  it('관리자 목록의 발행 글도 조회수 비집계 preview로 실제 이동한다', async () => {
    if (!page) throw new Error('Puppeteer page not initialized');
    await configureMockServer('admin');
    if (!process.env.E2E_MOCK_API_CONTROL_URL) {
      setLocalMockSession('admin');
      await setupDirectoryMocks(page);
    }

    await page.goto(`${WEB_BASE_URL}/admin/posts`, { waitUntil: 'networkidle0' });
    const previewLink = 'a[href="/admin/posts/43/preview"]';
    await page.waitForSelector(previewLink);
    await page.click(previewLink);
    await page.waitForFunction(() => window.location.pathname === '/admin/posts/43/preview');
    await page.waitForFunction(() =>
      document.body.innerText.includes('E2E 관리자 공개 preview 본문'),
    );
  });

  it('익명 사용자는 같은 draft의 공개 상세에서 404를 받는다', async () => {
    if (!browser) throw new Error('Puppeteer browser not initialized');
    await configureMockServer('anonymous');
    setLocalMockSession('anonymous');
    const anonymousPage = await browser.newPage();
    try {
      const response = await anonymousPage.goto(`${WEB_BASE_URL}/posts/42`, {
        waitUntil: 'networkidle0',
      });
      expect(response?.status()).toBe(404);
      await anonymousPage.waitForFunction(() =>
        document.body.innerText.includes('소식을 찾지 못했습니다.'),
      );
    } finally {
      await anonymousPage.close();
    }
  });
});
