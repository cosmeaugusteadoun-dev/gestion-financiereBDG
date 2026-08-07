// ============================================================
// sw.js — Service worker PWA : installabilité + usage hors-ligne
// Stratégie "réseau d'abord" : on essaie toujours la version en ligne la
// plus récente (les données Supabase changent en permanence), le cache ne
// sert qu'en secours quand la connexion est indisponible. Bump CACHE_NAME
// à chaque changement de fichier pour éviter de servir une version périmée
// (même piège de cache agressif déjà rencontré côté navigateur).
// ============================================================
var CACHE_NAME = "bulles-de-joie-v15";

var APP_SHELL = [
  "index.html",
  "app.html",
  "manifest.json",
  "assets/css/style.css",
  "assets/js/config.js",
  "assets/js/db.js",
  "assets/js/postes.js",
  "assets/js/whatsapp.js",
  "assets/js/enfants.js",
  "assets/js/entrees.js",
  "assets/js/sorties.js",
  "assets/js/dashboard.js",
  "assets/js/bilans.js",
  "assets/js/notes.js",
  "assets/js/app.js",
  "assets/js/pwa-install.js",
  "assets/img/logo.webp",
  "assets/img/icons/icon-192.png",
  "assets/img/icons/icon-512.png",
  "assets/img/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) => Promise.all(
      noms.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copie));
        return reponse;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((match) => match || caches.match("index.html")))
  );
});
