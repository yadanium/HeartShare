const CACHE_NAME = "heartshare-v8";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=8",
  "./script.js?v=8",
  "./manifest.webmanifest",
  "./icons/heart-icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS.map(asset => new Request(asset, { cache: "reload" })))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isAppShell =
    event.request.mode === "navigate" ||
    requestUrl.pathname.endsWith("/index.html") ||
    requestUrl.pathname.endsWith("/script.js") ||
    requestUrl.pathname.endsWith("/styles.css");

  event.respondWith(
    fetch(event.request, isAppShell ? { cache: "no-store" } : undefined)
      .then(response => {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
