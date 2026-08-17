/* ===========================================================
   Service Worker（オフライン対応）
   -----------------------------------------------------------
   ファイルを分割したので、install 時にまとめて取りに行っておく。
   実行中は Network First：まずネットワークを見て、
   つながらないときだけキャッシュを使う。
   ★ファイルを増やしたら ASSETS に足して、CACHE_VERSION を上げること★
   =========================================================== */

const CACHE_VERSION = 'monfar-v2';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/tracker.css',
  './css/simulator.css',
  './js/main.js',
  './js/store.js',
  './js/dom.js',
  './js/tabs.js',
  './js/species.js',
  './js/data/growth.js',
  './js/data/monsters.js',
  './js/data/icons.js',
  './js/tracker/tracker.js',
  './js/tracker/ideal.js',
  './js/simulator/simulator.js',
  './js/simulator/growth-calc.js',
  './js/reference/reference.js',
  './assets/icon-192.svg',
  './assets/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      // 1つ失敗しても install 全体を落とさない
      .then((cache) => Promise.allSettled(ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request).then((hit) => hit || caches.match('./index.html'))
      )
  );
});
