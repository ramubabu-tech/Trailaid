/* Great Falls TrailAid — offline service worker.
   Strategy: cache-first for the app shell so the app opens instantly with no
   signal; network is only used to refresh the cache when it's available. */

const CACHE = "trailaid-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "https://cdn.tailwindcss.com"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Cache what we can; a single failed asset (e.g. the CDN) must not
      // abort the whole install.
      Promise.allSettled(SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Serve from cache immediately, refresh in the background.
        event.waitUntil(
          fetch(req).then((res) => {
            if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          }).catch(() => {})
        );
        return cached;
      }
      return fetch(req).then((res) => {
        if (res && res.ok && (req.url.startsWith(self.location.origin) || req.url.includes("cdn.tailwindcss.com"))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() =>
        // Last resort: if a navigation fails offline, hand back the app shell.
        req.mode === "navigate" ? caches.match("./index.html") : Response.error()
      );
    })
  );
});
