import type { Page, HTTPRequest, Awaitable } from 'puppeteer';

export async function setupDirectoryMocks(page: Page): Promise<void> {
  await page.setRequestInterception(true);
  const handler = async (request: HTTPRequest): Awaitable<void> => {
    try {
      const url = new URL(request.url());
      const path = url.pathname;
      if (request.method() === 'GET' && path === '/members') {
        const off = Number(url.searchParams.get('offset') ?? '0');
        const limit = Number(url.searchParams.get('limit') ?? '10');
        const size = Math.min(10, limit);
        const items = Array.from({ length: size }, (_, i) => {
          const id = off + i + 1;
          return {
            id,
            email: `user${id}@example.com`,
            name: `User ${id}`,
            cohort: 10,
            major: 'Economics',
            company: 'ACME',
            industry: 'IT',
            roles: 'member',
            visibility: 'all'
          };
        });
        await request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(items)
        });
        return;
      }
      if (request.method() === 'GET' && path === '/members/count') {
        await request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 25 })
        });
        return;
      }
      await request.continue();
    } catch {
      await request.continue();
    }
  };
  page.on('request', handler);
}
