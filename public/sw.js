// Offline copy of the register. Built files (/_next/static) never change at
// the same URL, so they are cached as they load. The register page itself is
// fetched fresh whenever possible and the last good copy is used offline.
const CACHE = "register-v1";
const PAGE = "/store/register";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate" && url.pathname === PAGE) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Don't keep the login page if the session ran out.
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(PAGE, copy));
          }
          return res;
        })
        .catch(() => caches.match(PAGE).then((hit) => hit ?? Response.error())),
    );
  }
});
