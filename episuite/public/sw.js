const CACHE = 'episuite-shell-v9';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/domain.js', '/engagement.js', '/calendar.js', '/social.js', '/social-domain.js', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('episuite-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(()=>clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); } return response; }).catch(async () => await caches.match(event.request) || (event.request.mode === 'navigate' ? await caches.match('/') : undefined) || new Response('Offline asset unavailable', {status:503})));
});

self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{const client=windows[0];if(client){await client.navigate('/#plan');return client.focus();}return clients.openWindow('/#plan');}));});
