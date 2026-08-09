const CACHE_NAME = 'chinese-chess-v4';
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
    // 跳过等待，立即激活新版本
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('缓存资源');
                return cache.addAll(urlsToCache);
            })
    );
});

// 拦截请求 - 网络优先策略（确保JS/CSS总是获取最新版本）
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    // 对 JS 和 CSS 文件使用网络优先策略
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // 网络成功，更新缓存
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                    return response;
                })
                .catch(() => {
                    // 网络失败，使用缓存
                    return caches.match(event.request);
                })
        );
    } else {
        // 其他资源（图片等）使用缓存优先
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request);
                })
        );
    }
});

// 更新 Service Worker - 立即接管页面
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
        }).then(() => {
            // 立即接管所有页面
            return self.clients.claim();
        })
    );
});
