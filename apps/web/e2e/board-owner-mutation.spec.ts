import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { Browser, HTTPRequest, Page } from 'puppeteer';

import { WEB_BASE_URL } from './utils/env';
import { setLocalMockSession, setupDirectoryMocks } from './utils/mockApi';
import { configureMockServer } from './utils/mockServer';

let browser: Browser | null = null;
let page: Page | null = null;

async function waitForBodyText(currentPage: Page, expected: string): Promise<void> {
  await currentPage.waitForFunction(
    (text) => document.body.textContent?.includes(text),
    { timeout: 30_000 },
    expected,
  );
}

async function fillText(currentPage: Page, selector: string, value: string): Promise<void> {
  await currentPage.click(selector, { clickCount: 3 });
  await currentPage.type(selector, value);
}

async function clickDeleteConfirmation(currentPage: Page): Promise<void> {
  await currentPage.click('button.border-state-error-ring');
  await currentPage.waitForSelector('dialog[open]');
  await currentPage.$$eval('dialog[open] button', (buttons) => {
    const confirm = buttons.at(-1);
    if (!(confirm instanceof HTMLElement)) throw new Error('삭제 확인 버튼을 찾지 못했습니다.');
    confirm.click();
  });
}

async function clickButtonByText(currentPage: Page, text: string): Promise<void> {
  await currentPage.$$eval('button', (buttons, expectedText) => {
    const button = buttons.find((candidate) => candidate.textContent?.trim() === expectedText);
    if (!(button instanceof HTMLElement)) throw new Error(`버튼을 찾지 못했습니다: ${expectedText}`);
    button.click();
  }, text);
}

describe('Board post owner mutation (CDP E2E)', () => {
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

  it('작성자가 실제 수정·readback·삭제를 수행하고 owner endpoint를 사용한다', async () => {
    if (!page) throw new Error('Puppeteer page not initialized');

    await configureMockServer('member');
    if (!process.env.E2E_MOCK_API_CONTROL_URL) {
      setLocalMockSession('member');
      await setupDirectoryMocks(page);
    }

    const requests: Array<{ method: string; pathname: string }> = [];
    const recordRequest = (request: HTTPRequest) => {
      const url = new URL(request.url());
      if (url.port === '3001') {
        requests.push({ method: request.method(), pathname: url.pathname });
      }
    };
    page.on('request', recordRequest);

    await page.goto(`${WEB_BASE_URL}/board/45`, { waitUntil: 'networkidle0' });
    await waitForBodyText(page, 'E2E 회원 게시판 글');
    await page.click('a[href="/board/45/edit"]');
    await page.waitForFunction(() => window.location.pathname === '/board/45/edit');
    await page.waitForSelector('input[placeholder="글 제목을 입력하세요"]');

    await fillText(page, 'input[placeholder="글 제목을 입력하세요"]', 'E2E 수정된 회원 글');
    await fillText(page, 'textarea[placeholder="내용을 입력하세요"]', 'E2E 수정된 회원 본문');
    await clickButtonByText(page, '수정');
    await page.waitForFunction(() => window.location.pathname === '/board/45');
    await waitForBodyText(page, 'E2E 수정된 회원 글');
    await waitForBodyText(page, 'E2E 수정된 회원 본문');

    expect(requests).toContainEqual({ method: 'PATCH', pathname: '/board/posts/45' });
    expect(requests).not.toContainEqual({ method: 'PATCH', pathname: '/posts/45' });

    await page.goto(`${WEB_BASE_URL}/board/45`, { waitUntil: 'networkidle0' });
    await waitForBodyText(page, 'E2E 수정된 회원 본문');
    await clickDeleteConfirmation(page);
    await page.waitForFunction(() => window.location.pathname === '/board');
    await page.waitForFunction(() => !document.body.innerText.includes('E2E 수정된 회원 글'));

    expect(requests).toContainEqual({ method: 'DELETE', pathname: '/board/posts/45' });
    expect(requests).not.toContainEqual({ method: 'DELETE', pathname: '/posts/45' });
  });
});
