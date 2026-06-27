/* Sport Hub service worker — app shell offline.
   Solo cachea GET del mismo origen. NO toca las llamadas a Airtable (otro origen / POST). */
const CACHE = "sporthub-v5";
const ASSETS = [
  "./", "./index.html", "./app.js", "./crossfit.js", "./timer.js", "./coach.js", "./config.js",
  "./manifest.json", "./data/ejercicios.js", "./data/crossfit.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-512-maskable.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                       // POST a Airtable -> red
  if (new URL(req.url).origin !== self.location.origin) return; // fuentes/Unsplash -> red
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
