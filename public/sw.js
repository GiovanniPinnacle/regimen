// Regimen service worker — offline fallback, static-asset caching,
// push notifications + click routing.
//
// Caching policy (deliberately small):
// - Navigations: network-first. Pages are personalized + auth-gated, so
//   they are NEVER cached; when the network fails we serve the branded
//   /offline.html instead of the browser's dino page.
// - Static assets (/_next/static/*, icons, fonts): cache-first. Next's
//   build assets are content-hashed, so a cached copy is always correct.
// - API routes, auth routes, RSC/data requests, non-GET, cross-origin:
//   untouched (straight to network, never cached).
//
// Bump CACHE_VERSION to drop old caches on the next activation.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `regimen-static-${CACHE_VERSION}`;
const OFFLINE_CACHE = `regimen-offline-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon.svg"];
const STATIC_CACHE_MAX_ENTRIES = 200;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      // cache: "reload" bypasses the HTTP cache so we precache fresh copies.
      .then((cache) =>
        cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))),
      )
      .catch(() => {
        // Never block install on precache — push must keep working.
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, OFFLINE_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("regimen-") && !keep.has(n))
          .map((n) => caches.delete(n)),
      );
      // Navigation preload lets the network request start in parallel
      // with SW boot, so network-first adds no latency.
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          // unsupported — fine
        }
      }
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|svg|ico|jpg|jpeg|webp|avif|gif|woff2?)$/.test(url.pathname)
  );
}

async function trimCache(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function cacheFirst(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok && response.type === "basic") {
    event.waitUntil(
      cache
        .put(event.request, response.clone())
        .then(() => trimCache(cache, STATIC_CACHE_MAX_ENTRIES))
        .catch(() => {}),
    );
  }
  return response;
}

async function networkFirstNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const cache = await caches.open(OFFLINE_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ??
      new Response("You're offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never intercept API / auth traffic or RSC payload fetches.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event));
  }
  // Everything else: default browser handling (network).
});

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Regimen", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Regimen";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: data.url || "/today",
    },
    tag: data.tag || "regimen",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/today";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
