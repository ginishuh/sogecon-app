self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Placeholder for future offline caching logic
  event.waitUntil(self.clients.claim());
});
