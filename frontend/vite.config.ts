import { webcrypto } from 'node:crypto';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Node < 20 belum punya `crypto` global. Alat pembuat service worker (workbox) memakainya, di worker thread
// untuk langkah minify. Di Node lama minify dilewati (sw.js hanya beberapa KB); di Node 20+ tidak ada bedanya.
const nodeLama = Number(process.versions.node.split('.')[0]) < 20;
if (nodeLama) (globalThis as { crypto?: unknown }).crypto ??= webcrypto;

export default defineConfig({
  plugins: [
    react(),
    // Mode offline: service worker menyimpan "cangkang" aplikasi (HTML, JS, CSS, font) supaya aplikasi terbuka tanpa
    // internet. Data milik guru TIDAK disimpan di sini, melainkan di IndexedDB per akun (src/lib/offline).
    VitePWA({
      // 'prompt': versi baru menunggu persetujuan guru, supaya halaman tidak dimuat ulang saat sedang mengetik.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ajarin',
        short_name: 'Ajarin',
        description: 'Penerang jalan guru mengajar: modul ajar, bank soal, dan rekap nilai.',
        lang: 'id',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        theme_color: '#5350F7',
        background_color: '#FAF8F3',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        mode: nodeLama ? 'development' : 'production',
        // woff2 saja: semua browser yang mendukung service worker juga mendukung woff2 (KaTeX menyediakan woff2/woff/ttf).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // Permintaan API tidak pernah dijawab oleh service worker.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-berkas', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
