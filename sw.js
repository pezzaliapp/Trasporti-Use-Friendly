// Trasporti Use Friendly — Service Worker
// iOS-safe update strategy: precache with cache-bust + robust network-first for app shell
// Bump CACHE on every release that changes any asset or data file.

const CACHE = "trasporti-use-friendly-v1"; // <-- bump ad ogni release reale

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./sw.js",

  // Data
  "./data/articles.json",
  "./data/pallet_rates_by_region.json",
  "./data/groupage_rates.json",
  "./data/geo_provinces.json",

  // Icons
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// ---------- Helpers ----------
async function putInCache(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
}

async function networkFirst(request) {
  try {
    // cache: "no-store" helps; "reload" is handled by precacheAll() during install (useful on iOS).
    const fresh = await fetch(request, { cache: "no-store" });
    await putInCache(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request, { ignoreSearch: true });

  const fetchPromise = fetch(request)
    .then(async (fresh) => {
      if (fresh && fresh.ok) await putInCache(request, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || Response.error();
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const fresh = await fetch(request);
  if (fresh && fresh.ok) await putInCache(request, fresh.clone());
  return fresh;
}

// Precache “hard” to avoid Safari/iOS cached responses
async function precacheAll() {
  const cache = await caches.open(CACHE);

  for (const url of ASSETS) {
    const req = new Request(url, { cache: "reload" });
    try {
      const res = await fetch(req);
      if (res && res.ok) await cache.put(req, res);
    } catch (e) {
      // If offline during install, don't fail the install—previous cache will cover.
    }
  }
}

// ---------- Lifecycle ----------
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await precacheAll();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)));

    await self.clients.claim();

    // Notify clients that a new SW is active
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: "SW_UPDATED", cache: CACHE });
    }
  })());
});

// Allows page to force activate waiting SW (optional)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------- Fetch ----------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // same-origin only
  if (url.origin !== self.location.origin) return;

  // Navigations (important on iOS PWA)
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(new Request("./index.html")));
    return;
  }

  const path = url.pathname;

  // App shell: always network-first
  const isAppShell =
    path.endsWith("/index.html") ||
    path.endsWith("/app.js") ||
    path.endsWith("/styles.css") ||
    path.endsWith("/manifest.json") ||
    path.endsWith("/sw.js") ||
    path === "/" ||
    path.endsWith("/");

  if (isAppShell) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Critical datasets: always network-first (rule changes must propagate)
  if (
    path.endsWith("/data/articles.json") ||
    path.endsWith("/data/pallet_rates_by_region.json") ||
    path.endsWith("/data/groupage_rates.json")
  ) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Other JSON: stale-while-revalidate
  if (path.endsWith(".json")) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Everything else
  event.respondWith(cacheFirst(req));
});
