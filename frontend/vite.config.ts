import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Có bản mới → tự nhắc tải lại
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'iPaper - Luồng văn bản',
        short_name: 'iPaper',
        description: 'Hệ thống quản lý luồng văn bản, giao việc & phối hợp',
        theme_color: '#E4002B',
        background_color: '#ffffff',
        display: 'standalone', // Fullscreen, ẩn thanh URL — như app thật
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'vi',
        categories: ['business', 'productivity'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache app shell + assets. Không cache /api để luôn lấy data mới.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/ipaper-files\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
