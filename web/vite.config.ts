import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['ttc-icon.svg'],
      manifest: {
        name: 'TTC Navigator',
        short_name: 'TTC Nav',
        description: 'Offline-capable TTC subway navigation for Toronto',
        theme_color: '#DA291C',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/ttc-icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/alerts\.ttc\.ca\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ttc-alerts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'geocoding',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api/ttc-alerts': {
        target: 'https://alerts.ttc.ca',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ttc-alerts/, '/api/alerts/live-alerts'),
      },
    },
  },
  // SPA fallback so /emulate serves index.html
  appType: 'spa',
})
