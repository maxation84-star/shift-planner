// 근무표 플래너 - 오프라인 캐시. 배포마다 캐시 이름이 바뀌어(b2038b5) 새 버전이 바로 적용된다.
const CACHE = 'shiftplan-b2038b5';
const FILES = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // 공유 저장소 등 외부 요청은 그대로
  // 네트워크 우선(서버에 항상 재확인), 실패하면 캐시
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
