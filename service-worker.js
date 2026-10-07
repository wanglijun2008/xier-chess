const CACHE_NAME = 'chinese-chess-v14';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/chess.js',
    '/app.js',
    '/record-player.js',
    '/games-builtin.js',
    '/audio-pack.js',
    '/manifest.json',
    '/icon-512.png',
    '/audio/c001.mp3',
    '/audio/c002.mp3',
    '/audio/c003.mp3',
    '/audio/c004.mp3',
    '/audio/c005.mp3',
    '/audio/c006.mp3',
    '/audio/c007.mp3',
    '/audio/c008.mp3',
    '/audio/c009.mp3',
    '/audio/c010.mp3',
    '/audio/c011.mp3',
    '/audio/c012.mp3',
    '/audio/c013.mp3',
    '/audio/c014.mp3',
    '/audio/c015.mp3',
    '/audio/c016.mp3',
    '/audio/c017.mp3',
    '/audio/c018.mp3',
    '/audio/c019.mp3',
    '/audio/c020.mp3',
    '/audio/c021.mp3',
    '/audio/c022.mp3',
    '/audio/c023.mp3',
    '/audio/c024.mp3',
    '/audio/c025.mp3',
    '/audio/c026.mp3',
    '/audio/c027.mp3',
    '/audio/c028.mp3',
    '/audio/c029.mp3',
    '/audio/c030.mp3',
    '/audio/c031.mp3',
    '/audio/c032.mp3',
    '/audio/c033.mp3',
    '/audio/c034.mp3',
    '/audio/c035.mp3',
    '/audio/c036.mp3',
    '/audio/c037.mp3',
    '/audio/c038.mp3',
    '/audio/c039.mp3',
    '/audio/c040.mp3',
    '/audio/c041.mp3',
    '/audio/c042.mp3',
    '/audio/c043.mp3',
    '/audio/c044.mp3',
    '/audio/c045.mp3',
    '/audio/c046.mp3',
    '/audio/c047.mp3',
    '/audio/c048.mp3',
    '/audio/c049.mp3',
    '/audio/c050.mp3',
    '/audio/c051.mp3',
    '/audio/c052.mp3',
    '/audio/c053.mp3',
    '/audio/c054.mp3',
    '/audio/c055.mp3',
    '/audio/c056.mp3',
    '/audio/c057.mp3',
    '/audio/c058.mp3',
    '/audio/c059.mp3',
    '/audio/c060.mp3',
    '/audio/c061.mp3',
    '/audio/c062.mp3',
    '/audio/c063.mp3',
    '/audio/c064.mp3',
    '/audio/c065.mp3',
    '/audio/c066.mp3',
    '/audio/c067.mp3',
    '/audio/c068.mp3',
    '/audio/c069.mp3',
    '/audio/c070.mp3',
    '/audio/c071.mp3',
    '/audio/c072.mp3',
    '/audio/c073.mp3',
    '/audio/c074.mp3',
    '/audio/c075.mp3',
    '/audio/c076.mp3',
    '/audio/c077.mp3',
    '/audio/p001.mp3',
    '/audio/p002.mp3',
    '/audio/p003.mp3',
    '/audio/p004.mp3',
    '/audio/p005.mp3',
    '/audio/p006.mp3',
    '/audio/p007.mp3',
    '/audio/p008.mp3',
    '/audio/p009.mp3',
    '/audio/p010.mp3',
    '/audio/p011.mp3',
    '/audio/p012.mp3',
    '/audio/p013.mp3',
    '/audio/p014.mp3',
    '/audio/p015.mp3',
    '/audio/p016.mp3',
    '/audio/p017.mp3',
    '/audio/p018.mp3',
    '/audio/p019.mp3',
    '/audio/p020.mp3',
    '/audio/p021.mp3',
    '/audio/p022.mp3',
    '/audio/p023.mp3',
    '/audio/p024.mp3',
    '/audio/p025.mp3',
    '/audio/p026.mp3',
    '/audio/p027.mp3',
    '/audio/p028.mp3',
    '/audio/p029.mp3',
    '/audio/p030.mp3',
    '/audio/p031.mp3',
    '/audio/p032.mp3',
    '/audio/p033.mp3',
    '/audio/p034.mp3',
    '/audio/p035.mp3',
    '/audio/p036.mp3',
    '/audio/p037.mp3',
    '/audio/p038.mp3',
    '/audio/p039.mp3',
    '/audio/p040.mp3',
    '/audio/p041.mp3',
    '/audio/p042.mp3',
    '/audio/p043.mp3',
    '/audio/p044.mp3',
    '/audio/p045.mp3',
    '/audio/p046.mp3',
    '/audio/p047.mp3',
    '/audio/p048.mp3',
    '/audio/p049.mp3',
    '/audio/p050.mp3',
    '/audio/p051.mp3',
    '/audio/p052.mp3',
    '/audio/p053.mp3',
    '/audio/p054.mp3',
    '/audio/p055.mp3',
    '/audio/w001.mp3',
    '/audio/w002.mp3',
    '/audio/w003.mp3',
    '/audio/w004.mp3',
    '/audio/w005.mp3',
    '/audio/w006.mp3',
    '/audio/w007.mp3',
    '/audio/w008.mp3'
];

// 安装 Service Worker
self.addEventListener('install', event => {
    // 跳过等待，立即激活新版本
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('缓存资源');
                // 逐项缓存，单个资源（如图标）缺失不影响整体安装
                return Promise.all(urlsToCache.map(url =>
                    cache.add(url).catch(err => console.warn('缓存失败：' + url, err))
                ));
            })
    );
});

// 监听消息：强制跳过等待
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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
                    // 网络失败，尝试不带查询参数的URL匹配缓存
                    const cleanUrl = url.origin + url.pathname;
                    return caches.match(cleanUrl).then(r => {
                        if (r) return r;
                        return caches.match(event.request);
                    });
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
