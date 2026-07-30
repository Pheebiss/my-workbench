/* Service Worker - 工作台离线缓存 */
const CACHE = 'workbench-v25';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './poems.json',
  './manifest.json',
  './icon-app-192.png',
  './icon-app-512.png',
  './icon-app-180.png',
  './icon-app-maskable.png'
];

// 安装：预缓存核心资源
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 请求拦截：同源资源网络优先（保证最新代码），跨域 API 直接放行不缓存
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 跨域请求（天气/新闻/行情等 API）直接走网络，不缓存
  if (url.origin !== location.origin) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }
  // 同源资源：网络优先，失败回退缓存
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
