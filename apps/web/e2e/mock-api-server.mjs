import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = Number(process.env.E2E_MOCK_API_PORT ?? '3001');
const webOrigin = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
const activationToken = 'mock-activation-token';

let sessionKind = 'member';
let signupStatus = 'pending';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin ?? webOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
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

function heroSlides() {
  return [
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
    sessionKind = body.session === 'admin' ? 'admin' : 'member';
    signupStatus = 'pending';
    sendJson(response, 200, { ok: true, session: sessionKind }, origin);
    return;
  }
  if (method === 'GET' && url.pathname === '/auth/session') {
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
    sendJson(response, 200, heroSlides(), origin);
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
  if (method === 'GET' && (url.pathname === '/posts/' || url.pathname === '/events/')) {
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
