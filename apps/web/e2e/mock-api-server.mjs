import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = Number(process.env.E2E_MOCK_API_PORT ?? '3001');
const webOrigin = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
const activationToken = 'mock-activation-token';

let sessionKind = 'member';
let signupStatus = 'pending';
let ownerPostDeleted = false;
let ownerPostTitle = 'E2E 회원 게시판 글';
let ownerPostContent = 'E2E 회원 게시판 본문';
let ownerPostCoverImage = null;
let ownerPostImages = [];
let adminBoardPostTitle = 'E2E board 공개 글';
let adminBoardPostContent = 'published_at 없이도 공개되는 board 글';
let adminBoardPostPinned = false;
let adminBoardPostCoverImage = 'https://example.com/e2e-admin-cover.png';
let adminBoardPostImages = [adminBoardPostCoverImage];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin ?? webOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function sendJson(response, status, body, origin) {
  response.writeHead(status, {
    ...corsHeaders(origin),
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sessionPayload() {
  if (sessionKind === 'admin_hero') {
    return {
      kind: 'admin',
      id: 1,
      student_id: '__seed__hero__admin',
      email: 'hero-admin@test.example.com',
      name: 'Hero Admin',
      roles: ['member', 'admin', 'admin_hero'],
    };
  }
  if (sessionKind === 'admin') {
    return {
      kind: 'admin',
      id: 1,
      student_id: '__seed__admin',
      email: 'admin@test.example.com',
      name: 'Admin',
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

function signupRequestPayload(status) {
  return {
    id: 1,
    student_id: '20251234',
    email: 'new-member@example.com',
    name: '신규회원',
    cohort: 60,
    major: '경제학',
    phone: '010-1234-5678',
    note: '테스트 신청',
    status,
    requested_at: '2026-02-18T08:00:00Z',
    decided_at: status === 'approved' ? '2026-02-18T08:05:00Z' : null,
    activated_at: null,
    decided_by_student_id: status === 'approved' ? '__seed__admin' : null,
    reject_reason: null,
  };
}

function activationIssuePayload() {
  return {
    request: signupRequestPayload('approved'),
    activation_context: {
      signup_request_id: 1,
      student_id: '20251234',
      email: 'new-member@example.com',
      name: '신규회원',
      cohort: 60,
    },
    activation_token: activationToken,
    activation_issue: {
      id: 1,
      signup_request_id: 1,
      issued_type: 'approve',
      issued_by_student_id: '__seed__admin',
      token_tail: 'ion-token',
      issued_at: '2026-02-18T08:05:00Z',
    },
  };
}

function ownerPostPayload() {
  return {
    id: 45,
    title: ownerPostTitle,
    content: ownerPostContent,
    category: 'discussion',
    author_id: 1,
    author_name: '테스트 회원',
    published_at: null,
    pinned: false,
    cover_image: ownerPostCoverImage,
    images: ownerPostImages,
    view_count: 3,
    comment_count: 0,
  };
}

function adminBoardPostPayload() {
  return {
    id: 44,
    title: adminBoardPostTitle,
    content: adminBoardPostContent,
    category: 'discussion',
    published_at: null,
    pinned: adminBoardPostPinned,
    cover_image: adminBoardPostCoverImage,
    images: adminBoardPostImages,
    view_count: 2,
    author_name: 'Member',
    comment_count: 1,
  };
}

function isBoardPostsList(url) {
  const categories = [url.searchParams.get('category'), ...url.searchParams.getAll('categories')];
  return categories.some((category) => ['discussion', 'question', 'share', 'congrats'].includes(category));
}

function heroSlides(includeUnpublished) {
  const slides = [
    {
      id: 1,
      target_type: 'post',
      target_id: 1,
      title: 'E2E 첫 번째 배너',
      description: 'E2E 첫 번째 배너 설명',
      image: '/images/home/hero-launch.svg',
      href: '/posts',
      unpublished: false,
    },
    {
      id: 2,
      target_type: 'event',
      target_id: 1,
      title: 'E2E 두 번째 배너',
      description: 'E2E 두 번째 배너 설명',
      image: '/images/home/hero.svg',
      href: '/events',
      unpublished: false,
    },
  ];
  if (includeUnpublished) {
    slides.unshift({
      id: 3,
      target_type: 'post',
      target_id: 42,
      title: 'E2E 관리자 초안',
      description: '관리자 hero preview 본문으로 이동하는지 확인',
      image: '/images/home/hero.svg',
      href: '/posts/42',
      unpublished: true,
    });
  }
  return slides;
}

function directoryMembers(url) {
  const offset = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number(url.searchParams.get('limit') ?? '10');
  return Array.from({ length: Math.min(10, limit) }, (_, index) => {
    const id = offset + index + 1;
    return {
      id,
      email: `user${id}@example.com`,
      name: `User ${id}`,
      cohort: 10,
      major: 'Economics',
      company: 'ACME',
      industry: 'IT',
      visibility: 'all',
    };
  });
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);
  const method = request.method ?? 'GET';

  if (method === 'OPTIONS') {
    response.writeHead(204, corsHeaders(origin));
    response.end();
    return;
  }

  if (method === 'GET' && url.pathname === '/healthz') {
    sendJson(response, 200, { ok: true }, origin);
    return;
  }
  if (method === 'POST' && url.pathname === '/__e2e/config') {
    const body = await readJson(request);
    sessionKind = ['anonymous', 'member', 'admin', 'admin_hero'].includes(body.session)
      ? body.session
      : 'member';
    signupStatus = 'pending';
    ownerPostDeleted = false;
    ownerPostTitle = 'E2E 회원 게시판 글';
    ownerPostContent = 'E2E 회원 게시판 본문';
    ownerPostCoverImage = null;
    ownerPostImages = [];
    adminBoardPostTitle = 'E2E board 공개 글';
    adminBoardPostContent = 'published_at 없이도 공개되는 board 글';
    adminBoardPostPinned = false;
    adminBoardPostCoverImage = 'https://example.com/e2e-admin-cover.png';
    adminBoardPostImages = [adminBoardPostCoverImage];
    sendJson(response, 200, { ok: true, session: sessionKind }, origin);
    return;
  }
  if (method === 'GET' && url.pathname === '/auth/session') {
    if (sessionKind === 'anonymous') {
      sendJson(response, 401, { code: 'not_authenticated', detail: 'Not authenticated' }, origin);
      return;
    }
    sendJson(response, 200, sessionPayload(), origin);
    return;
  }
  if (method === 'POST' && url.pathname === '/auth/member/signup') {
    signupStatus = 'pending';
    sendJson(response, 201, signupRequestPayload(signupStatus), origin);
    return;
  }
  if (method === 'GET' && url.pathname === '/admin/signup-requests/') {
    sendJson(
      response,
      200,
      { items: [signupRequestPayload(signupStatus)], total: 1 },
      origin
    );
    return;
  }
  if (method === 'POST' && url.pathname === '/admin/signup-requests/1/approve') {
    signupStatus = 'approved';
    sendJson(response, 200, activationIssuePayload(), origin);
    return;
  }
  if (
    method === 'GET' &&
    url.pathname === '/admin/signup-requests/1/activation-token-logs'
  ) {
    sendJson(
      response,
      200,
      { items: [activationIssuePayload().activation_issue] },
      origin
    );
    return;
  }
  if (method === 'POST' && url.pathname === '/auth/member/activate') {
    sendJson(response, 200, { ok: 'true' }, origin);
    return;
  }
  if (method === 'GET' && url.pathname === '/hero/') {
    sendJson(response, 200, heroSlides(url.searchParams.get('include_unpublished') === 'true'), origin);
    return;
  }
  if (method === 'GET' && url.pathname === '/admin/posts/') {
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
      ...adminBoardPostPayload(),
    }];
    const status = url.searchParams.get('status');
    const items = status === 'published'
      ? posts.filter((post) => post.id === 43 || post.id === 44)
      : status === 'draft'
        ? posts.filter((post) => post.id === 42)
        : status === 'scheduled'
          ? []
          : posts;
    sendJson(response, 200, {
      items,
      total: items.length,
    }, origin);
    return;
  }
  if (method === 'POST' && url.pathname === '/admin/hero/lookup') {
    sendJson(response, 200, { items: [] }, origin);
    return;
  }
  if (method === 'GET' && url.pathname === '/comments/') {
    sendJson(response, 200, [], origin);
    return;
  }
  if (method === 'GET' && url.pathname === '/posts/45') {
    if (ownerPostDeleted) {
      sendJson(response, 404, { code: 'post_not_found', detail: 'Post not found' }, origin);
      return;
    }
    sendJson(response, 200, ownerPostPayload(), origin);
    return;
  }
  if (method === 'PATCH' && url.pathname === '/board/posts/45') {
    if (ownerPostDeleted) {
      sendJson(response, 404, { code: 'post_not_found', detail: 'Post not found' }, origin);
      return;
    }
    const body = await readJson(request);
    if (typeof body.title === 'string') ownerPostTitle = body.title;
    if (typeof body.content === 'string') ownerPostContent = body.content;
    if (Object.prototype.hasOwnProperty.call(body, 'cover_image')) {
      ownerPostCoverImage = body.cover_image;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'images')) {
      ownerPostImages = body.images;
    }
    sendJson(response, 200, ownerPostPayload(), origin);
    return;
  }
  if (method === 'DELETE' && url.pathname === '/board/posts/45') {
    if (ownerPostDeleted) {
      sendJson(response, 404, { code: 'post_not_found', detail: 'Post not found' }, origin);
      return;
    }
    ownerPostDeleted = true;
    sendJson(response, 200, { ok: true, deleted_id: 45 }, origin);
    return;
  }
  if (method === 'PATCH' && url.pathname === '/posts/44') {
    const body = await readJson(request);
    if (['category', 'published_at', 'unpublish'].some((field) => Object.hasOwn(body, field))) {
      sendJson(response, 422, { code: 'board_category_immutable', detail: 'board fields are immutable' }, origin);
      return;
    }
    if (typeof body.title === 'string') adminBoardPostTitle = body.title;
    if (typeof body.content === 'string') adminBoardPostContent = body.content;
    if (typeof body.pinned === 'boolean') adminBoardPostPinned = body.pinned;
    if (Object.hasOwn(body, 'cover_image')) adminBoardPostCoverImage = body.cover_image;
    if (Object.hasOwn(body, 'images')) adminBoardPostImages = body.images;
    sendJson(response, 200, adminBoardPostPayload(), origin);
    return;
  }
  const previewMatch = url.pathname.match(/^\/admin\/posts\/(42|43|44)\/preview$/);
  if (method === 'GET' && previewMatch) {
    const postId = Number(previewMatch[1]);
    if (postId === 44) {
      sendJson(response, 200, adminBoardPostPayload(), origin);
      return;
    }
    const isPublished = postId === 43;
    sendJson(response, 200, {
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
    }, origin);
    return;
  }
  if (method === 'GET' && url.pathname === '/members/') {
    sendJson(response, 200, directoryMembers(url), origin);
    return;
  }
  if (method === 'GET' && url.pathname === '/members/count') {
    sendJson(response, 200, { count: 25 }, origin);
    return;
  }
  if (method === 'GET' && url.pathname === '/posts/') {
    sendJson(response, 200, !ownerPostDeleted && isBoardPostsList(url) ? [ownerPostPayload()] : [], origin);
    return;
  }
  if (method === 'GET' && url.pathname === '/events/') {
    sendJson(response, 200, [], origin);
    return;
  }
  if (method === 'POST' && url.pathname === '/rum/vitals') {
    sendJson(response, 200, { ok: true }, origin);
    return;
  }

  sendJson(
    response,
    404,
    { code: 'e2e_mock_route_missing', detail: `${method} ${url.pathname}` },
    origin
  );
});

server.listen(port, host, () => {
  console.log(`[e2e-mock-api] listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
