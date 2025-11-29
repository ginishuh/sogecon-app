const OFFLINE_CACHE = 'offline-shell-v1';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  // 최소 오프라인 페이지를 미리 캐싱하여 네비게이션 실패 시 노출
  const cacheOfflineShell = caches
    .open(OFFLINE_CACHE)
    .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
    .catch(() => undefined);
  event.waitUntil(Promise.resolve(cacheOfflineShell).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // 구버전 캐시를 정리하고 즉시 제어권을 획득
  const cleanup = caches
    .keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key))));
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
  } catch (e) {
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

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
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
});
