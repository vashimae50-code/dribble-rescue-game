// いつも 新しい ファイルを つかう ための しくみ（サービスワーカー）
// ブラウザは 公開サイトの ファイルを しばらく（GitHub Pages は 10分）手元に のこして つかうので、
// 更新した あとも 古い ゲームが 出ることが ある。ここで 同じ サイトの ファイルを 読むときは かならず サーバーに
// 「かわった？」と きく（かわって いなければ 304 で 手元の ものを つかう ので、通信は ほとんど ふえない）。
// ネットに つながらない ときは 手元に ある ものを そのまま つかう
const SKIP = /\.(mp3|m4a|mp4|webm|ogg|wav)(\?|$)/i; // 音・動画は ブラウザに まかせる（とちゅうから 読む しくみが あるため）
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || SKIP.test(url.pathname) || req.headers.has('range')) return;
  const fresh = req.mode === 'navigate' ? fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' });
  e.respondWith(fresh.catch(() => fetch(req)));
});
