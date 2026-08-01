import type { Page, HTTPRequest } from 'puppeteer';

import { WEB_BASE_URL } from './env';

type LocalMockSession = 'anonymous' | 'member' | 'admin' | 'admin_hero';
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
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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

function isLocalAnonymousSession(): boolean {
  return localMockSession === 'anonymous';
}

async function respondAnonymousSessionApi(request: HTTPRequest, url: URL): Promise<boolean> {
  if (request.method() !== 'GET' || url.pathname !== '/auth/session' || !isLocalAnonymousSession()) {
    return false;
  }
  await request.respond({
    status: 401,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify({ code: 'not_authenticated', detail: 'Not authenticated' }),
  });
  return true;
}

async function respondAdminPostPreviewApi(request: HTTPRequest, url: URL): Promise<boolean> {
  const match = url.pathname.match(/^\/admin\/posts\/(42|43|44)\/preview$/);
  if (request.method() !== 'GET' || !match) return false;
  const postId = Number(match[1]);
  if (postId === 44) {
    await request.respond({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(localAdminBoardPostPayload()),
    });
    return true;
  }
  const isPublished = postId === 43;
  await request.respond({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify({
      id: postId,
      title: isPublished ? 'E2E 관리자 공개 글' : 'E2E 관리자 초안',
      content: isPublished ? 'E2E 관리자 공개 preview 본문' : 'E2E 관리자 preview 본문',
      category: 'notice',
      published_at: isPublished ? '2026-07-31T00:00:00Z' : null,
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

let localOwnerPostDeleted = false;
let localOwnerPostTitle = 'E2E 회원 게시판 글';
let localOwnerPostContent = 'E2E 회원 게시판 본문';
let localOwnerPostCoverImage: string | null = null;
let localOwnerPostImages: string[] = [];
let localAdminBoardPostTitle = 'E2E board 공개 글';
let localAdminBoardPostContent = 'published_at 없이도 공개되는 board 글';
let localAdminBoardPostPinned = false;

function localOwnerPostPayload() {
  return {
    id: 45,
    title: localOwnerPostTitle,
    content: localOwnerPostContent,
    category: 'discussion',
    author_id: 1,
    author_name: '테스트 회원',
    published_at: null,
    pinned: false,
    cover_image: localOwnerPostCoverImage,
    images: localOwnerPostImages,
    view_count: 3,
    comment_count: 0,
  };
}

function localAdminBoardPostPayload() {
  return {
    id: 44,
    title: localAdminBoardPostTitle,
    content: localAdminBoardPostContent,
    category: 'discussion',
    published_at: null,
    pinned: localAdminBoardPostPinned,
    cover_image: null,
    images: null,
    view_count: 2,
    author_name: 'Member',
    comment_count: 1,
  };
}

function resetLocalOwnerPost(): void {
  localOwnerPostDeleted = false;
  localOwnerPostTitle = 'E2E 회원 게시판 글';
  localOwnerPostContent = 'E2E 회원 게시판 본문';
  localOwnerPostCoverImage = null;
  localOwnerPostImages = [];
  localAdminBoardPostTitle = 'E2E board 공개 글';
  localAdminBoardPostContent = 'published_at 없이도 공개되는 board 글';
  localAdminBoardPostPinned = false;
}

function isLocalBoardPostsList(url: URL): boolean {
  const categories = [url.searchParams.get('category'), ...url.searchParams.getAll('categories')];
  return categories.some((category) => ['discussion', 'question', 'share', 'congrats'].includes(category ?? ''));
}

async function respondOwnerPostDetailApi(request: HTTPRequest, url: URL): Promise<boolean> {
  if (url.port !== '3001' || request.method() !== 'GET' || url.pathname !== '/posts/45') {
    return false;
  }
  await request.respond({
    status: localOwnerPostDeleted ? 404 : 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(localOwnerPostDeleted
      ? { code: 'post_not_found', detail: 'Post not found' }
      : localOwnerPostPayload()),
  });
  return true;
}

async function respondOwnerPostListApi(request: HTTPRequest, url: URL): Promise<boolean> {
  if (url.port !== '3001' || request.method() !== 'GET' || url.pathname !== '/posts/') {
    return false;
  }
  const body = localOwnerPostDeleted || !isLocalBoardPostsList(url)
    ? []
    : [localOwnerPostPayload()];
  await request.respond({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
  return true;
}

async function respondOwnerPostReadApi(request: HTTPRequest, url: URL): Promise<boolean> {
  return (await respondOwnerPostDetailApi(request, url))
    || (await respondOwnerPostListApi(request, url));
}

async function respondOwnerPostPatchApi(request: HTTPRequest, url: URL): Promise<boolean> {
  if (url.port !== '3001' || request.method() !== 'PATCH' || url.pathname !== '/board/posts/45') {
    return false;
  }
  const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
  if (typeof body.title === 'string') localOwnerPostTitle = body.title;
  if (typeof body.content === 'string') localOwnerPostContent = body.content;
  if (Object.prototype.hasOwnProperty.call(body, 'cover_image')) {
    localOwnerPostCoverImage = body.cover_image as string | null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'images')) {
    localOwnerPostImages = body.images as string[];
  }
  await request.respond({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(localOwnerPostPayload()),
  });
  return true;
}

async function respondOwnerPostDeleteApi(request: HTTPRequest, url: URL): Promise<boolean> {
  if (url.port !== '3001' || request.method() !== 'DELETE' || url.pathname !== '/board/posts/45') {
    return false;
  }
  localOwnerPostDeleted = true;
  await request.respond({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify({ ok: true, deleted_id: 45 }),
  });
  return true;
}

async function respondOwnerPostMutationApi(request: HTTPRequest, url: URL): Promise<boolean> {
  return (await respondOwnerPostPatchApi(request, url))
    || (await respondOwnerPostDeleteApi(request, url));
}

async function respondAdminBoardPostPatchApi(request: HTTPRequest, url: URL): Promise<boolean> {
  if (url.port !== '3001' || request.method() !== 'PATCH' || url.pathname !== '/posts/44') {
    return false;
  }
  const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
  if (['category', 'published_at', 'unpublish'].some((field) => Object.hasOwn(body, field))) {
    await request.respond({
      status: 422,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ code: 'board_category_immutable', detail: 'board fields are immutable' }),
    });
    return true;
  }
  if (typeof body.title === 'string') localAdminBoardPostTitle = body.title;
  if (typeof body.content === 'string') localAdminBoardPostContent = body.content;
  if (typeof body.pinned === 'boolean') localAdminBoardPostPinned = body.pinned;
  await request.respond({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(localAdminBoardPostPayload()),
  });
  return true;
}

async function respondOwnerPostApi(request: HTTPRequest, url: URL): Promise<boolean> {
  return (await respondOwnerPostReadApi(request, url))
    || (await respondOwnerPostMutationApi(request, url));
}

async function respondAdminPostsApi(request: HTTPRequest, url: URL): Promise<boolean> {
  if (request.method() !== 'GET' || url.pathname !== '/admin/posts/') return false;
  const posts = [{
    id: 42,
    title: 'E2E 관리자 초안',
    content: 'E2E 관리자 preview 본문',
    category: 'notice',
    published_at: null,
    pinned: false,
    cover_image: null,
    images: null,
    view_count: 0,
    author_name: 'Admin',
    comment_count: 0,
  }, {
    id: 43,
    title: 'E2E 관리자 공개 글',
    content: 'E2E 관리자 공개 본문',
    category: 'notice',
    published_at: '2026-07-31T00:00:00Z',
    pinned: false,
    cover_image: null,
    images: null,
    view_count: 7,
    author_name: 'Admin',
    comment_count: 0,
  }, {
    ...localAdminBoardPostPayload(),
  }];
  const status = url.searchParams.get('status');
  const items = status === 'published'
    ? posts.filter((post) => post.id === 43 || post.id === 44)
    : status === 'draft'
      ? posts.filter((post) => post.id === 42)
      : status === 'scheduled'
        ? []
        : posts;
  await request.respond({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify({
      items,
      total: items.length,
    }),
  });
  return true;
}

async function respondAdminHeroLookupApi(request: HTTPRequest, url: URL): Promise<boolean> {
  if (request.method() !== 'POST' || url.pathname !== '/admin/hero/lookup') return false;
  await request.respond({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify({ items: [] }),
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

async function respondCommentsApi(request: HTTPRequest, url: URL): Promise<boolean> {
  if (request.method() !== 'GET' || url.pathname !== '/comments/') return false;
  await request.respond({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify([]),
  });
  return true;
}

export async function setupDirectoryMocks(page: Page): Promise<void> {
  if (process.env.E2E_MOCK_API_CONTROL_URL) return;
  resetLocalOwnerPost();
  await page.setRequestInterception(true);
  const handlers = [
    respondHeroApi,
    respondAdminPostsApi,
    respondAdminHeroLookupApi,
    respondAdminPostPreviewApi,
    respondAdminBoardPostPatchApi,
    respondOwnerPostApi,
    respondCommentsApi,
    respondAnonymousSessionApi,
    respondDirectoryApi,
  ];
  const handler = async (request: HTTPRequest): Promise<void> => {
    try {
      const url = new URL(request.url());
      for (const respond of handlers) {
        if (await respond(request, url)) return;
      }
      await request.continue();
    } catch {
      await request.continue();
    }
  };
  page.on('request', handler);
}
