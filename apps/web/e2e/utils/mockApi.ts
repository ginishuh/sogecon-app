import type { Page, HTTPRequest } from 'puppeteer';

import { WEB_BASE_URL } from './env';

type LocalMockSession = 'member' | 'admin' | 'admin_hero';
let localMockSession: LocalMockSession = 'member';

export function setLocalMockSession(session: LocalMockSession): void {
  localMockSession = session;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': WEB_BASE_URL,
  'Access-Control-Allow-Credentials': 'true',
};

async function respondCorsPreflight(request: HTTPRequest, url: URL): Promise<boolean> {
  if (url.port !== '3001' || request.method() !== 'OPTIONS') return false;
  await request.respond({
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: '',
  });
  return true;
}

async function respondHeroApi(request: HTTPRequest, url: URL): Promise<boolean> {
  if (request.method() !== 'GET' || url.pathname !== '/hero/') return false;
  await request.respond({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify([
      ...(url.searchParams.get('include_unpublished') === 'true'
        ? [{
            id: 3,
            target_type: 'post',
            target_id: 42,
            title: 'E2E 관리자 초안',
            description: '관리자 hero preview 본문으로 이동하는지 확인',
            image: '/images/home/hero.svg',
            href: '/posts/42',
            unpublished: true,
          }]
        : []),
      {
        id: 1,
        target_type: 'post',
        target_id: 1,
        title: 'E2E 첫 번째 배너',
        description: 'Tailwind 시각 회귀 검증용 첫 번째 배너',
        image: '/images/home/hero-launch.svg',
        href: '/posts',
        unpublished: false,
      },
      {
        id: 2,
        target_type: 'event',
        target_id: 1,
        title: 'E2E 두 번째 배너',
        description: 'Tailwind 시각 회귀 검증용 두 번째 배너',
        image: '/images/home/hero.svg',
        href: '/events',
        unpublished: false,
      },
    ]),
  });
  return true;
}

function localSessionPayload(): {
  kind: 'admin' | 'member';
  id: number;
  student_id: string;
  email: string;
  name: string;
  roles: string[];
} {
  if (localMockSession === 'admin_hero') {
    return {
      kind: 'admin',
      id: 1,
      student_id: 'hero-admin001',
      email: 'hero-admin@example.com',
      name: 'Hero 관리자',
      roles: ['member', 'admin', 'admin_hero'],
    };
  }
  if (localMockSession === 'admin') {
    return {
      kind: 'admin',
      id: 1,
      student_id: 'admin001',
      email: 'admin@example.com',
      name: '관리자',
      roles: ['member', 'admin', 'super_admin', 'admin_signup', 'admin_roles'],
    };
  }
  return {
    kind: 'member',
    id: 1,
    student_id: '20250001',
    email: 'member@example.com',
    name: '테스트 회원',
    roles: ['member'],
  };
}

async function respondAdminPostPreviewApi(request: HTTPRequest, url: URL): Promise<boolean> {
  if (request.method() !== 'GET' || url.pathname !== '/admin/posts/42/preview') return false;
  await request.respond({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify({
      id: 42,
      title: 'E2E 관리자 초안',
      content: 'E2E 관리자 preview 본문',
      category: 'notice',
      published_at: null,
      pinned: false,
      cover_image: null,
      images: null,
      view_count: 0,
      author_name: 'Hero Admin',
      comment_count: 0,
    }),
  });
  return true;
}

async function respondDirectoryApi(request: HTTPRequest, url: URL): Promise<boolean> {
  const method = request.method();
  const path = url.pathname;
  if (await respondCorsPreflight(request, url)) return true;
  if (method === 'GET' && path === '/auth/session') {
    await request.respond({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(localSessionPayload()),
    });
    return true;
  }
  if (method === 'GET' && path === '/members') {
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
        visibility: 'all',
      };
    });
    await request.respond({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(items),
    });
    return true;
  }
  if (method === 'GET' && path === '/members/count') {
    await request.respond({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ count: 25 }),
    });
    return true;
  }
  return false;
}

export async function setupDirectoryMocks(page: Page): Promise<void> {
  if (process.env.E2E_MOCK_API_CONTROL_URL) return;
  await page.setRequestInterception(true);
  const handler = async (request: HTTPRequest): Promise<void> => {
    try {
      const url = new URL(request.url());
      if (await respondHeroApi(request, url)) return;
      if (await respondAdminPostPreviewApi(request, url)) return;
      if (await respondDirectoryApi(request, url)) return;
      await request.continue();
    } catch {
      await request.continue();
    }
  };
  page.on('request', handler);
}
