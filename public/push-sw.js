// Rappels Stoemp : chargé dans le service worker de l'appli (vite.config.ts → workbox.importScripts).
// Les messages arrivent « données seules » (Firebase Cloud Messaging) : on les affiche nous-mêmes.
self.addEventListener("push", (event) => {
  let d = {};
  try { const j = event.data ? event.data.json() : {}; d = j.data || j.notification || j; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(d.title || "Stoemp", {
    body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag, lang: "fr-BE",
    icon: new URL("icons/icon-192.png", self.registration.scope).href, badge: new URL("icons/icon-192.png", self.registration.scope).href,
    data: { link: d.link || "" },
  }));
});

// Toucher la notification : ouvre (ou ramène) Stoemp sur le bon écran.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL("./" + ((event.notification.data && event.notification.data.link) || ""), self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) { if ("navigate" in c) c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
