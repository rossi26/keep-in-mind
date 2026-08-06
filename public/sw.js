/* Keep in Mind — Service Worker
 * Strategy:
 *  - Precache the app shell (index, manifest, icons, fonts) on install.
 *  - Runtime: stale-while-revalidate for same-origin GET requests.
 *  - Navigation requests: network-first, fall back to cached index.html.
 *  - Cache versioned so we can purge old caches on activate.
 */
const CACHE_VERSION = 'keep-in-mind-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

/* ---------- Install: precache the app shell ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ---------- Activate: clean up old caches ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------- Fetch ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Only handle same-origin requests
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh navigation response
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Static assets (JS/CSS/images): stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // Only cache valid responses
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      // Return cached immediately if available, otherwise wait for network
      return cached || networkFetch;
    })
  );
});