/**
 * Service Worker for Physiological Signals PWA
 * Handles offline support, caching, and background sync
 */

const CACHE_VERSION = 'v1'
const CACHE_NAME = `physiological-signals-${CACHE_VERSION}`

// Files to cache on install
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Continue even if some assets fail to cache
        console.log('Some assets failed to cache, continuing offline support')
      })
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('physiological-signals')) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response && response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }
        return response
      })
      .catch(() => {
        // Fall back to cache on network failure
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || new Response('Offline - resource not available', { status: 503 })
        })
      })
  )
})

// Background sync for data upload (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Sync logic would go here
      Promise.resolve()
    )
  }
})
