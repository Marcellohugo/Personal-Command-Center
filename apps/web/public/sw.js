const CACHE_PREFIX = "marco-life-os-";
const CACHE_NAME = `${CACHE_PREFIX}v13`;
const OFFLINE_URL = "/offline.html";
const APP_ROUTES = ["/dashboard"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll([OFFLINE_URL, "/manifest.webmanifest"]);
        const pages = await Promise.all(APP_ROUTES.map((route) => fetch(route)));
        const assets = [];

        for (let index = 0; index < pages.length; index += 1) {
          const response = pages[index];
          await cache.put(APP_ROUTES[index], response.clone());
          const html = await response.text();
          for (const match of html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)) {
            assets.push(match[1]);
          }
        }

        await cache.addAll([...new Set(assets)]);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const routeKey = url.pathname + url.search;
          if (response.ok && APP_ROUTES.includes(routeKey)) {
            caches.open(CACHE_NAME).then((cache) => cache.put(routeKey, response.clone()));
          }
          return response;
        })
        .catch(() => {
          const fallback = url.pathname === "/"
            ? "/dashboard"
            : url.pathname + url.search;
          return caches.match(fallback).then((response) => response || caches.match(OFFLINE_URL));
        })
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
      )
    );
  }
});

self.addEventListener("push", (event) => {
  let notification = {};
  try {
    notification = event.data ? event.data.json() : {};
  } catch {
    notification = { body: event.data ? event.data.text() : "Saatnya melanjutkan progresmu." };
  }

  event.waitUntil(self.registration.showNotification(notification.title || "Marco Life OS", {
    body: notification.body || "Saatnya melanjutkan progresmu.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: notification.tag || "marco-life-os-reminder",
    renotify: false,
    data: { url: notification.url || "/dashboard" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
