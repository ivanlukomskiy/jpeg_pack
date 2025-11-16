import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.ico',
        'robots.txt',
        'apple-touch-icon.png'
      ],
      manifest: {
        name: 'JPEG Pack',
        short_name: 'JPEG Pack',
        description: 'Pack and unpack JPEG spritesheets in the browser',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        scope: '/jpeg_pack/',
        start_url: '/jpeg_pack/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}'
        ],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1600,
  },
  base: '/jpeg_pack/',
  // test: {
  //   globals: true,
  //   environment: 'jsdom',
  //   setupFiles: './src/test/setup.ts',
  // },
});
