/**
 * Service Worker — 캐싱 전략
 * - 오프라인 셸: 네비게이션 실패 시 /offline 페이지
 * - 정적 자산 (JS/CSS/폰트): Cache First
 * - 이미지: Cache First
 * - API 응답: Stale-While-Revalidate
 */

const CACHE_VERSION = 'v2';
const OFFLINE_CACHE = `offline-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline';

// 캐시 만료 시간 (밀리초)
const API_CACHE_MAX_AGE = 5 * 60 * 1000; // 5분

// 유효한 캐시 이름 목록
const VALID_CACHES = [OFFLINE_CACHE, STATIC_CACHE, IMAGE_CACHE, API_CACHE];

self.addEventListener('install', (event) => {
  // 오프라인 페이지 프리캐싱
  const cacheOfflineShell = caches
    .open(OFFLINE_CACHE)
    .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
    .catch(() => undefined);
  event.waitUntil(Promise.resolve(cacheOfflineShell).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // 구버전 캐시 정리 (현재 버전 캐시만 유지)
  const cleanup = caches.keys().then((keys) =>
    Promise.all(
      keys
        .filter((key) => !VALID_CACHES.includes(key))
        .map((key) => caches.delete(key))
    )
  );
  event.waitUntil(Promise.resolve(cleanup).then(() => self.clients.claim()));
});

// 푸시 수신 핸들러: 서버에서 전달한 JSON {title, body, url?}
self.addEventListener('push', (event) => {
  let payload = { title: '알림', body: '', url: undefined };
  try {
    if (event.data) {
      const data = event.data.json();
      payload = { ...payload, ...data };
    }
  } catch {
    // ignore malformed payload
  }
  const title = payload.title || '알림';
  const options = {
    body: payload.body || '',
    data: { url: payload.url }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 클릭 시 포커스/열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (!url) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// 클라이언트에서 SKIP_WAITING 메시지 수신 시 즉시 활성화
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * 요청 URL 패턴 매칭 헬퍼
 */
function isStaticAsset(url) {
  return /\/_next\/static\//.test(url.pathname) || /\.(js|css|woff2?)$/.test(url.pathname);
}

function isImage(url) {
  return /\.(png|jpg|jpeg|gif|webp|avif|svg|ico)$/.test(url.pathname) || url.pathname.startsWith('/images/');
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

/**
 * Cache First 전략 — 정적 자산용
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // 네트워크 실패 시 캐시에서 찾기 (이미 위에서 없음을 확인했으므로 에러)
    throw error;
  }
}

/**
 * Stale-While-Revalidate 전략 — API 응답용
 * 캐시된 응답이 있으면 즉시 반환하고, 백그라운드에서 갱신
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // 백그라운드에서 네트워크 요청
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        // 타임스탬프와 함께 캐시 저장
        const responseToCache = response.clone();
        const headers = new Headers(responseToCache.headers);
        headers.set('sw-cache-time', Date.now().toString());

        void responseToCache.blob().then((body) => {
          return cache.put(
            request,
            new Response(body, {
              status: responseToCache.status,
              statusText: responseToCache.statusText,
              headers
            })
          );
        });
      }
      return response;
    })
    .catch(() => cached); // 네트워크 실패 시 캐시 반환

  // 캐시가 있으면 즉시 반환, 없으면 네트워크 대기
  if (cached) {
    // 캐시 만료 확인
    const cacheTime = parseInt(cached.headers.get('sw-cache-time') || '0', 10);
    if (Date.now() - cacheTime < API_CACHE_MAX_AGE) {
      return cached;
    }
  }

  return fetchPromise;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 같은 origin의 요청만 처리
  if (url.origin !== self.location.origin) {
    return;
  }

  // GET 요청만 캐싱
  if (event.request.method !== 'GET') {
    return;
  }

  // 네비게이션 요청 — 오프라인 폴백
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(OFFLINE_CACHE);
        const cachedResponse = await cache.match(OFFLINE_URL);
        if (cachedResponse) {
          return cachedResponse;
        }
        return Response.redirect(OFFLINE_URL, 302);
      })
    );
    return;
  }

  // 정적 자산 — Cache First
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // 이미지 — Cache First
  if (isImage(url)) {
    event.respondWith(cacheFirst(event.request, IMAGE_CACHE));
    return;
  }

  // API 요청 — Stale-While-Revalidate
  if (isApiRequest(url)) {
    event.respondWith(staleWhileRevalidate(event.request, API_CACHE));
    return;
  }
});
