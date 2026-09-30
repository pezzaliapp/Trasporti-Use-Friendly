/* La vecchia app è stata sostituita: questo service worker si rimuove da solo
   e porta chi la usa ancora alla nuova app. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const cl = await self.clients.matchAll({ type: "window" });
    cl.forEach((c) => c.navigate(new URL("../calcolo-trasporti/", self.registration.scope).href));
  })());
});
