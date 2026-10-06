// 오프라인 사용을 위한 캐시. 파일을 고치면 VERSION 을 올린다.
var VERSION = 'v2-2026-10-06';
var FILES = ['./', 'index.html', 'assets/style.css', 'assets/laws.js', 'assets/engine.js', 'assets/checklist.js', 'assets/app.js', 'assets/icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// 네트워크 우선, 실패하면 캐시 (법령 갱신이 바로 반영되도록)
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
