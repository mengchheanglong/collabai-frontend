// CollabAI Progressive Web App Service Worker
const CACHE_NAME = 'collabai-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/logo.svg',
  '/collab small.png',
];

// Install event - precache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// Activate event - cleanup stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch event - network-first with cache fallback for navigation and static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not cache API or Socket.io traffic
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) {
    return;
  }

  // Navigation requests: Network first, fall back to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Static assets: Stale-while-revalidate
  if (
    url.origin === self.location.origin &&
    (url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.woff2'))
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => cached);

        return cached || fetchPromise;
      }),
    );
  }
});

// ── Web Push Notifications ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: 'CollabAI',
    body: 'You have a new update in your workspace.',
    url: '/board',
    icon: '/collab small.png',
    badge: '/favicon.svg',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/collab small.png',
    badge: data.badge || '/favicon.svg',
    data: {
      url: data.url || '/board',
      timestamp: Date.now(),
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open CollabAI' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ── Notification Click Routing ───────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/board';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If an existing window is open, focus it and navigate
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            client.focus();
            if ('navigate' in client && client.url !== targetUrl) {
              return client.navigate(targetUrl);
            }
            return client;
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
