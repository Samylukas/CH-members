// Service Worker - منظومة الخدمة والرعاية الكنسية (v43 Multi-Meetings Hub + Weekly/Monthly Table)
const CACHE_NAME = 'church-system-cache-v43';
const APP_SHELL = [
    './',
    './index.html',
    './app.js?v=43',
    './style.css',
    './logo.png',
    './manifest.json'
];
const EXTERNAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // تخزين ملفات التطبيق الأساسية
            for (const url of APP_SHELL) {
                try { await cache.add(url); } catch (e) {}
            }
            // تخزين مكتبات التصميم والرسوم البيانية (Tailwind & Chart.js) للعمل بدون إنترنت
            for (const extUrl of EXTERNAL_ASSETS) {
                try {
                    const req = new Request(extUrl, { mode: 'no-cors' });
                    const res = await fetch(req);
                    if (res) await cache.put(extUrl, res);
                } catch (e) {}
            }
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // استثناء طلبات فحص الاتصال الحقيقي (?ping=) وطلبات API (Google Apps Script) من الكاش
    if (url.searchParams.has('ping') || url.hostname.includes('clients3.google.com') || url.pathname.includes('generate_204') || url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
        return;
    }

    // صفحات التنقل الرئيسية (index.html): شبكة أولاً ثم الكاش
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).then((networkRes) => {
                const clone = networkRes.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone)).catch(() => {});
                return networkRes;
            }).catch(() => caches.match('./index.html') || caches.match('./'))
        );
        return;
    }

    // باقي الملفات (JS, CSS, صور, Tailwind CDN, Chart.js): الكاش أولاً مع تحديث صامت في الخلفية
    event.respondWith(
        caches.match(req, { ignoreSearch: false }).then((cached) => {
            const fetchPromise = fetch(req).then((networkRes) => {
                if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
                    const clone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
                }
                return networkRes;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});
