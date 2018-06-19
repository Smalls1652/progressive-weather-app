var dataCacheName = 'progressive-weather-app-datacache';
var CACHE_NAME = 'progressive-weather-app';
var urlsToCache = [
 "/font",
 "/font/weathericons-regular-webfont.eot",
 "/font/weathericons-regular-webfont.svg",
 "/font/weathericons-regular-webfont.ttf",
 "/font/weathericons-regular-webfont.woff",
 "/font/weathericons-regular-webfont.woff2",
 "/images",
 "/images/icons",
 "/images/icons/icon-128x128.png",
 "/images/icons/icon-144x144.png",
 "/images/icons/icon-152x152.png",
 "/images/icons/icon-192x192.png",
 "/images/icons/icon-256x256.png",
 "/images/icons/icon-512x512.png",
 "/images/icons/icon.svg",
 "/index.html",
 "/manifest.json",
 "/scripts",
 "/scripts/app.js",
 "/scripts/main.js",
 "/scripts/search.js",
 "/scripts/localforage.js",
 "/style",
 "/style/weather-icons.css",
 "/style/main.css"
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', function(event) {

  var cacheWhitelist = [];

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});