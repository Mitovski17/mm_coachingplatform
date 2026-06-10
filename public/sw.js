// ─── Mitovski Coaching PWA Service Worker ────────────────────────────────────
// Strategy:
//   • Static assets (JS/CSS/fonts/images/icons) → Cache-first, fallback network
//   • Navigation (HTML pages)                   → Network-first, fallback cache
//   • Supabase API / Next.js server actions      → Network-only (never cache auth/data)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'v2'
const STATIC_CACHE  = `static-${CACHE_VERSION}`
const PAGE_CACHE    = `pages-${CACHE_VERSION}`

// Assets we want cached immediately on install
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// ─── Install: precache critical shell assets ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Non-fatal: some icons may not exist yet
      })
    ).then(() => self.skipWaiting())
  )
})

// ─── Activate: purge old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ─── Fetch: route-based caching strategy ─────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 1. Never intercept non-GET or cross-origin requests
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // 2. Never cache Supabase API calls or Next.js server actions / API routes
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/') ||
    url.hostname.includes('supabase.co')
  ) {
    return
  }

  // 3. Static assets (_next/static, fonts, icons, images) → cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(woff2?|ttf|otf|eot)$/) ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|gif)$/) ||
    url.pathname.match(/\.(js|css)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // 4. HTML navigation → network-first, fallback to cache or offline page
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request))
    return
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Network error', { status: 408 })
  }
}

async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(PAGE_CACHE)

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached

    const offline = await caches.match('/offline.html')
    return offline || new Response('Offline', { status: 503 })
  }
}
