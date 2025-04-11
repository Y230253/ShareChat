// サービスワーカー for ShareChat
// キャッシュ名とバージョン
const CACHE_NAME = 'sharechat-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/vite.svg'
];

// インストール時にキャッシュを準備
self.addEventListener('install', event => {
  console.log('Service Worker: インストール中');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: キャッシュをオープン');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// アクティベーション時に古いキャッシュを削除
self.addEventListener('activate', event => {
  console.log('Service Worker: アクティブ化');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: 古いキャッシュを削除', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// フェッチイベントの処理
self.addEventListener('fetch', event => {
  // APIリクエストはそのまま転送
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('googleapis.com') || 
      event.request.url.includes('storage.googleapis.com/sharechat-media-bucket/uploads/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // リロード時の特殊処理：HTML5履歴モードのSPA向け
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        
        // その他のリソースはキャッシュから提供
        return caches.match(event.request);
      })
  );
});