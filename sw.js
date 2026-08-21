/* BB SMM Workspace service worker.

   NETWORK-FIRST for the page itself. This is deliberate and it is not the
   cautious default: this app ships as one file that changes most days, and a
   cache-first worker would hand the team yesterday's build while every push
   reported success. GitHub Pages already serves a stale copy for a minute or
   two after a deploy, so adding a second layer of staleness on top of that is
   how a fix "does not work" for a week.

   The cache is a FALLBACK for no signal, which is the real point: an SMM on a
   bad connection between client meetings still gets the workspace open.

   Bump CACHE when the shell list changes, never for a content change. */
const CACHE = 'bb-smm-v1';
const SHELL = ['./', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .catch(() => {})            /* a missing asset must not block install */
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  /* Never touch Supabase. Cached client data would be worse than no data:
     the team would tick a board that is not the board any more. */
  if (req.url.indexOf('supabase.co') > -1) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./')))
  );
});
