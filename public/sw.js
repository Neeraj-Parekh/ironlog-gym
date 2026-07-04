// ============================================================
// Service Worker — offline-first cache for the gym PWA
// Stale-while-revalidate for app shell, network-first for API
// Enhanced: pre-caches routes, handles navigation requests,
// versioned cache to auto-invalidate stale hashed assets
// ============================================================
const CACHE_NAME = "ironlog-v3";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/offline.html",
];

// Offline fallback page (inline-generated if not pre-cached)
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>IronLog — Offline</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fafafa; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; padding: 2rem; text-align: center; }
  .card { max-width: 320px; }
  h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
  p { color: #a1a1aa; font-size: 0.875rem; margin: 0 0 1.5rem; }
  button { background: #fafafa; color: #0a0a0a; border: 0; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; }
</style>
</head>
<body>
<div class="card">
<h1>You're Offline</h1>
<p>IronLog works offline — your data is saved locally. Reconnect to sync.</p>
<button onclick="location.reload()">Try Again</button>
</div>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      // Pre-cache offline page
      const offlineResponse = new Response(OFFLINE_HTML, {
        headers: { "Content-Type": "text/html" },
      });
      await cache.put("/offline.html", offlineResponse);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for API routes
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req) ?? caches.match("/offline.html"))
    );
    return;
  }

  // Navigation requests → serve app shell, fallback to offline page
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone());
          return res;
        } catch {
          const cached = await caches.match(req);
          return cached ?? (await caches.match("/offline.html"));
        }
      })()
    );
    return;
  }

  // For hashed static assets (.next/static, JS/CSS chunks) → cache-first
  // These never change once deployed, so cache-first is safe and fast
  if (url.pathname.includes("/_next/static/") || url.pathname.match(/\.(js|css|woff2?)$/)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          return new Response("", { status: 408 });
        }
      })()
    );
    return;
  }

  // Stale-while-revalidate for everything else
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached ?? fetchPromise;
    })()
  );
});
