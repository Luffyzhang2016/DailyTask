const CACHE = 'daymark-v13';
const ASSETS = ['./','./index.html','./styles.css','./config.js','./app.js','./manifest.webmanifest','./icons/app-icon.svg',...Array.from({length:10},(_,i)=>`./icons/avatars/avatar-${String(i+1).padStart(2,'0')}.webp`)];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(response => response || caches.match('./index.html'))));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(openClients => {
    const existing=openClients.find(client=>'focus' in client);
    return existing?existing.focus():clients.openWindow('./');
  }));
});
