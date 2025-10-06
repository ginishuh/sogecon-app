self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Placeholder for future offline caching logic
  event.waitUntil(self.clients.claim());
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
