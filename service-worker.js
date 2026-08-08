const CACHE_NAME = 'chinese-chess-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/chess.js',
    '/app.js',
    '/manifest.json',
    '/icon-512.png'
];

// 安装 Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('缓存资源');
                return cache.addAll(urlsToCache);
            })
    );
});

// 拦截请求
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response; // 使用缓存
                }
                return fetch(event.request); // 否则从网络获取
            })
    );
});

// 更新 Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
