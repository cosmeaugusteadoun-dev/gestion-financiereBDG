// ============================================================
// sw.js — Service worker PWA : installabilité + usage hors-ligne
// Stratégie "réseau d'abord" : on essaie toujours la version en ligne la
// plus récente (les données Supabase changent en permanence), le cache ne
// sert qu'en secours quand la connexion est indisponible. Bump CACHE_NAME
// à chaque changement de fichier pour éviter de servir une version périmée
// (même piège de cache agressif déjà rencontré côté navigateur).
// ============================================================
var CACHE_NAME = "bulles-de-joie-v50";

var APP_SHELL = [
  "index.html",
  "app.html",
  "manifest.json",
  "assets/css/style.css",
  "assets/js/config.js",
  "assets/js/auth.js",
  "assets/js/db.js",
  "assets/js/postes.js",
  "assets/js/whatsapp.js",
  "assets/js/whatsapp-modeles.js",
  "assets/js/whatsapp-api.js",
  "assets/js/enfants.js",
  "assets/js/entrees.js",
  "assets/js/sorties.js",
  "assets/js/dashboard.js",
  "assets/js/bilans.js",
  "assets/js/notes.js",
  "assets/js/app.js",
  "assets/js/push-notifications.js",
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
      noms.filter((n) => n !== CACHE_NAME && n !== "bdj-push-state-v1").map((n) => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Les réponses de la base et de l'authentification ne doivent jamais
  // être mises en cache ni remplacées par une ancienne réponse hors ligne.
  const url = new URL(req.url);
  if (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in")) return;

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

self.addEventListener("message", event => {
  const d=event.data;
  if(d?.type!=="BDJ_BIRTHDAY_READ" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !Number.isSafeInteger(d.count) || d.count<0)return;
  event.waitUntil((async()=>{
    const cache=await caches.open("bdj-push-state-v1");
    await cache.put(new URL("push-read-state",self.registration.scope).href,new Response(JSON.stringify({date:d.date,count:d.count})));
    if(self.navigator?.clearAppBadge)await self.navigator.clearAppBadge().catch(()=>{});
  })());
});
self.addEventListener("push", event => {
  event.waitUntil((async()=>{
    let data;try{data=event.data?.json();}catch(_){}
    const parts=new Intl.DateTimeFormat("en",{timeZone:"Africa/Porto-Novo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const v=t=>parts.find(p=>p.type===t).value;
    const today=v("year")+"-"+v("month")+"-"+v("day");
    const actuel=data?.type==="anniversaires" && data.date===today && Number.isSafeInteger(data.count) && data.count>0;
    const count=actuel?data.count:0;
    let lus=0;
    try{
      const cache=await caches.open("bdj-push-state-v1");
      const response=await cache.match(new URL("push-read-state",self.registration.scope).href);
      const state=response?await response.json():null;
      if(state?.date===today)lus=Number(state.count)||0;
    }catch(_){}
    const restant=Math.max(count-lus,0);
    try{
      if(restant&&self.navigator?.setAppBadge)await self.navigator.setAppBadge(restant);
      else if(self.navigator?.clearAppBadge)await self.navigator.clearAppBadge();
    }catch(_){}
    // Toujours une notification visible : les navigateurs refusent les pushes silencieux.
    await self.registration.showNotification("Les Bulles de Joie",{
      body:actuel?(count===1?"Vous avez un anniversaire à consulter aujourd'hui.":"Vous avez "+count+" anniversaires à consulter aujourd'hui."):"Ouvrez le tableau de bord pour consulter les alertes du jour.",
      icon:new URL("assets/img/icons/icon-192.png",self.registration.scope).href,
      badge:new URL("assets/img/icons/icon-192.png",self.registration.scope).href,
      tag:"bdj-anniversaires-"+today,
      data:{type:"anniversaires",date:today,count,url:new URL("app.html?notifications=anniversaires",self.registration.scope).href}
    });
  })());
});
self.addEventListener("notificationclick", event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    if(self.navigator?.clearAppBadge)await self.navigator.clearAppBadge().catch(()=>{});
    const url=new URL("app.html?notifications=anniversaires",self.registration.scope);
    const ouverts=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    const cible=ouverts.find(c=>new URL(c.url).origin===url.origin&&new URL(c.url).pathname===url.pathname);
    if(cible){await cible.focus();cible.postMessage({type:"BDJ_OPEN_BIRTHDAYS"});}
    else await self.clients.openWindow(url.href);
  })());
});
